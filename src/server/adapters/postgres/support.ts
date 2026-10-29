import { ApiError } from '@/lib/errors';
import type {
  SupportAttachment,
  SupportAttachmentInput,
  SupportMessage,
  SupportRepository,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketSummary,
} from '@/lib/ports';
import type { ISODateString, Paginated, UUID } from '@/lib/types';
import type { Db, SqlParam } from '@/lib/ports/db';

type Row = Record<string, unknown>;

const str = (value: unknown): string => String(value ?? '');
const nullableStr = (value: unknown): string | null => value == null ? null : String(value);
const iso = (value: unknown): ISODateString => new Date(String(value)).toISOString();
const int = (value: unknown): number => Number(value ?? 0);

function mapAttachment(row: Row): SupportAttachment {
  return {
    id: str(row.id) as UUID,
    ticketId: str(row.ticket_id) as UUID,
    messageId: str(row.message_id) as UUID,
    uploaderId: row.uploader_id == null ? null : str(row.uploader_id) as UUID,
    uploaderRole: str(row.uploader_role) as SupportAttachment['uploaderRole'],
    bucketId: str(row.bucket_id),
    storagePath: str(row.storage_path),
    originalName: str(row.original_name),
    mimeType: str(row.mime_type),
    sizeBytes: int(row.size_bytes),
    createdAt: iso(row.created_at),
  };
}

function mapTicket(row: Row): SupportTicket {
  return {
    id: str(row.id) as UUID,
    userId: str(row.user_id) as UUID,
    subject: str(row.subject),
    category: str(row.category) as SupportTicketCategory,
    priority: str(row.priority) as SupportTicketPriority,
    status: str(row.status) as SupportTicketStatus,
    assignedTo: row.assigned_to == null ? null : str(row.assigned_to) as UUID,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapMessage(row: Row, attachments: SupportAttachment[] = []): SupportMessage {
  return {
    id: str(row.id) as UUID,
    ticketId: str(row.ticket_id) as UUID,
    senderId: row.sender_id == null ? null : str(row.sender_id) as UUID,
    senderRole: str(row.sender_role) as SupportMessage['senderRole'],
    body: str(row.body),
    createdAt: iso(row.created_at),
    readAt: row.read_at == null ? null : iso(row.read_at),
    attachments,
  };
}

function mapSummary(row: Row): SupportTicketSummary {
  return {
    ...mapTicket(row),
    userNumericId: row.user_numeric_id == null ? null : int(row.user_numeric_id),
    userEmail: nullableStr(row.user_email),
    userDisplayName: nullableStr(row.user_display_name),
    unreadMessages: int(row.unread_messages),
    lastMessageAt: row.last_message_at == null ? null : iso(row.last_message_at),
  };
}

export class PostgresSupportRepository implements SupportRepository {
  constructor(readonly db: Db) {}

  async listForUser(userId: UUID, filter: { status?: SupportTicketStatus; page?: number; pageSize?: number } = {}): Promise<Paginated<SupportTicketSummary>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const values: SqlParam[] = [userId];
    let statusSql = '';
    if (filter.status) {
      values.push(filter.status);
      statusSql = `and t.status = $${values.length}`;
    }
    values.push(pageSize, offset);
    const rows = await this.db.query<Row>(
      `select t.*, p.numeric_id as user_numeric_id, p.email as user_email, p.display_name as user_display_name,
              0::int as unread_messages,
              max(tm.created_at) as last_message_at,
              count(*) over() as total_count
         from public.tickets t
         left join nova.profiles p on p.id = t.user_id
         left join public.ticket_messages tm on tm.ticket_id = t.id
        where t.user_id = $1 ${statusSql}
        group by t.id, p.numeric_id, p.email, p.display_name
        order by t.updated_at desc
        limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const total = rows.length ? int(rows[0]?.total_count) : 0;
    return { items: rows.map(mapSummary), page, pageSize, total, hasMore: page * pageSize < total };
  }

  async getForUser(ticketId: UUID, userId: UUID): Promise<SupportTicket | null> {
    const rows = await this.db.query<Row>(
      `select * from public.tickets where id = $1 and user_id = $2 limit 1`,
      [ticketId, userId],
    );
    return rows[0] ? mapTicket(rows[0]) : null;
  }

  async listMessages(ticketId: UUID, userId?: UUID): Promise<SupportMessage[]> {
    const values: SqlParam[] = [ticketId];
    const ownerSql = userId ? `and exists (select 1 from public.tickets t where t.id = tm.ticket_id and t.user_id = $2)` : '';
    if (userId) values.push(userId);
    const rows = await this.db.query<Row>(
      `select tm.*
         from public.ticket_messages tm
        where tm.ticket_id = $1 ${ownerSql}
        order by tm.created_at asc`,
      values,
    );
    if (!rows.length) return [];
    const messageIds = rows.map((row) => str(row.id));
    const attachmentRows = await this.db.query<Row>(
      `select *
         from public.ticket_attachments
        where message_id in (${messageIds.map((_, index) => `$${index + 1}`).join(", ")})
        order by created_at asc`,
      messageIds,
    );
    const attachmentsByMessage = new Map<string, SupportAttachment[]>();
    for (const row of attachmentRows) {
      const attachment = mapAttachment(row);
      const list = attachmentsByMessage.get(attachment.messageId) ?? [];
      list.push(attachment);
      attachmentsByMessage.set(attachment.messageId, list);
    }
    return rows.map((row) => mapMessage(row, attachmentsByMessage.get(str(row.id)) ?? []));
  }

  async markMessagesRead(ticketId: UUID, role: 'user' | 'support', viewerId: UUID): Promise<number> {
    // A player may only acknowledge their own conversation. Agents require
    // support.view permission at the HTTP boundary; never trust a client role.
    const whereOwner = role === 'user'
      ? 'and exists (select 1 from public.tickets t where t.id = tm.ticket_id and t.user_id = $3)'
      : '';
    const rows = await this.db.query<Row>(
      `update public.ticket_messages tm set read_at = now()
         where tm.ticket_id = $1 and tm.sender_role = $2 and tm.read_at is null
           ${whereOwner}
       returning tm.id`,
      role === 'user' ? [ticketId, 'support', viewerId] : [ticketId, 'user'],
    );
    return rows.length;
  }

  async touchAgentPresence(agentId: UUID): Promise<void> {
    await this.db.query(
      `insert into public.support_agent_presence (agent_id, last_seen)
       values ($1, now())
       on conflict (agent_id) do update set last_seen = excluded.last_seen`,
      [agentId],
    );
  }

  async isAgentOnline(): Promise<boolean> {
    const rows = await this.db.query<Row>(
      `select exists (
          select 1 from public.support_agent_presence
          where last_seen > now() - interval '55 seconds'
        ) as online`, [],
    );
    return rows[0]?.online === true;
  }

  async createTicket(input: {
    userId: UUID;
    subject: string;
    category: SupportTicketCategory;
    priority?: SupportTicketPriority;
    body: string;
  }): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    if (!input.subject.trim() || !input.body.trim()) {
      throw new ApiError('VALIDATION_FAILED', 'Subject and message are required.');
    }
    return this.db.transaction(async (tx) => {
      const tickets = await tx.query<Row>(
        `insert into public.tickets (user_id, subject, category, priority, status)
         values ($1, $2, $3, $4, 'waiting_support')
         returning *`,
        [input.userId, input.subject.trim(), input.category, input.priority ?? 'normal'],
      );
      const ticket = tickets[0];
      if (!ticket) throw new ApiError('INTERNAL_ERROR', 'Failed to create support ticket.');
      const messages = await tx.query<Row>(
        `insert into public.ticket_messages (ticket_id, sender_id, sender_role, body)
         values ($1, $2, 'user', $3)
         returning *`,
        [str(ticket.id), input.userId, input.body.trim()],
      );
      const message = messages[0];
      if (!message) throw new ApiError('INTERNAL_ERROR', 'Failed to create support message.');
      return { ticket: mapTicket(ticket), message: mapMessage(message) };
    });
  }

  async addUserMessage(input: {
    ticketId: UUID;
    userId: UUID;
    body: string;
    attachment?: SupportAttachmentInput;
  }): Promise<SupportMessage> {
    if (!input.body.trim() && !input.attachment) {
      throw new ApiError('VALIDATION_FAILED', 'Message or attachment is required.');
    }
    return this.db.transaction(async (tx) => {
      const tickets = await tx.query<Row>(
        `select * from public.tickets where id = $1 and user_id = $2 for update`,
        [input.ticketId, input.userId],
      );
      const ticket = tickets[0];
      if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
      if (['closed', 'resolved'].includes(str(ticket.status))) {
        throw new ApiError('CONFLICT', 'This support ticket is closed.');
      }
      const messages = await tx.query<Row>(
        `insert into public.ticket_messages (ticket_id, sender_id, sender_role, body)
         values ($1, $2, 'user', $3)
         returning *`,
        [input.ticketId, input.userId, input.body.trim()],
      );
      await tx.query(`update public.tickets set status = 'waiting_support' where id = $1`, [input.ticketId]);
      const message = messages[0];
      if (!message) throw new ApiError('INTERNAL_ERROR', 'Failed to create support message.');
      let attachments: SupportAttachment[] = [];
      if (input.attachment) {
        const attachmentRows = await tx.query<Row>(
          `insert into public.ticket_attachments
             (ticket_id, message_id, uploader_id, uploader_role, bucket_id, storage_path, original_name, mime_type, size_bytes)
           values ($1, $2, $3, 'user', $4, $5, $6, $7, $8)
           returning *`,
          [
            input.ticketId,
            str(message.id),
            input.attachment.uploaderId,
            input.attachment.bucketId,
            input.attachment.storagePath,
            input.attachment.originalName,
            input.attachment.mimeType,
            input.attachment.sizeBytes,
          ],
        );
        attachments = attachmentRows.map(mapAttachment);
      }
      return mapMessage(message, attachments);
    });
  }

  async closeForUser(ticketId: UUID, userId: UUID): Promise<SupportTicket> {
    const rows = await this.db.query<Row>(
      `update public.tickets set status = 'closed'
        where id = $1 and user_id = $2 and status <> 'closed'
        returning *`,
      [ticketId, userId],
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
    return mapTicket(rows[0]);
  }

  async listForAdmin(filter: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
    assignedTo?: UUID | null;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<Paginated<SupportTicketSummary>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const values: SqlParam[] = [];
    const where: string[] = [];
    const add = (value: SqlParam) => { values.push(value); return `$${values.length}`; };
    if (filter.status) where.push(`t.status = ${add(filter.status)}`);
    if (filter.category) where.push(`t.category = ${add(filter.category)}`);
    if (filter.priority) where.push(`t.priority = ${add(filter.priority)}`);
    if (filter.assignedTo === null) where.push(`t.assigned_to is null`);
    else if (filter.assignedTo) where.push(`t.assigned_to = ${add(filter.assignedTo)}`);
    if (filter.search?.trim()) {
      const q = add(`%${filter.search.trim()}%`);
      const numeric = add(filter.search.trim());
      where.push(`(t.subject ilike ${q} or p.email ilike ${q} or p.display_name ilike ${q} or p.numeric_id::text = ${numeric})`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const limitParam = add(pageSize);
    const offsetParam = add(offset);
    const rows = await this.db.query<Row>(
      `select t.*, p.numeric_id as user_numeric_id, p.email as user_email, p.display_name as user_display_name,
              (select count(*)::int
                 from public.ticket_messages pending
                where pending.ticket_id=t.id and pending.sender_role='user'
                  and pending.created_at > coalesce(
                    (select max(answer.created_at) from public.ticket_messages answer
                      where answer.ticket_id=t.id and answer.sender_role='support'),
                    t.created_at - interval '1 second')
              ) as unread_messages,
              max(tm.created_at) as last_message_at,
              count(*) over() as total_count
         from public.tickets t
         left join nova.profiles p on p.id = t.user_id
         left join public.ticket_messages tm on tm.ticket_id = t.id
         ${whereSql}
        group by t.id, p.numeric_id, p.email, p.display_name
        order by t.updated_at desc
        limit ${limitParam} offset ${offsetParam}`,
      values,
    );
    const total = rows.length ? int(rows[0]?.total_count) : 0;
    return { items: rows.map(mapSummary), page, pageSize, total, hasMore: page * pageSize < total };
  }

  async getForAdmin(ticketId: UUID): Promise<SupportTicketSummary | null> {
    const rows = await this.db.query<Row>(
      `select t.*, p.numeric_id as user_numeric_id, p.email as user_email, p.display_name as user_display_name,
              (select count(*)::int
                 from public.ticket_messages pending
                where pending.ticket_id=t.id and pending.sender_role='user'
                  and pending.created_at > coalesce(
                    (select max(answer.created_at) from public.ticket_messages answer
                      where answer.ticket_id=t.id and answer.sender_role='support'),
                    t.created_at - interval '1 second')
              ) as unread_messages,
              max(tm.created_at) as last_message_at
         from public.tickets t
         left join nova.profiles p on p.id = t.user_id
         left join public.ticket_messages tm on tm.ticket_id = t.id
        where t.id = $1
        group by t.id, p.numeric_id, p.email, p.display_name
        limit 1`,
      [ticketId],
    );
    return rows[0] ? mapSummary(rows[0]) : null;
  }

  async addSupportMessage(input: {
    ticketId: UUID;
    actorId: UUID;
    body: string;
    attachment?: SupportAttachmentInput;
  }): Promise<SupportMessage> {
    if (!input.body.trim() && !input.attachment) {
      throw new ApiError('VALIDATION_FAILED', 'Message or attachment is required.');
    }
    return this.db.transaction(async (tx) => {
      const tickets = await tx.query<Row>(
        `select * from public.tickets where id = $1 for update`,
        [input.ticketId],
      );
      const ticket = tickets[0];
      if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
      if (['closed', 'resolved'].includes(str(ticket.status))) {
        throw new ApiError('CONFLICT', 'This support ticket is closed.');
      }
      const messages = await tx.query<Row>(
        `insert into public.ticket_messages (ticket_id, sender_id, sender_role, body)
         values ($1, $2, 'support', $3)
         returning *`,
        [input.ticketId, input.actorId, input.body.trim()],
      );
      await tx.query(`update public.tickets set status = 'waiting_user' where id = $1`, [input.ticketId]);
      const message = messages[0];
      if (!message) throw new ApiError('INTERNAL_ERROR', 'Failed to create support message.');
      let attachments: SupportAttachment[] = [];
      if (input.attachment) {
        const attachmentRows = await tx.query<Row>(
          `insert into public.ticket_attachments
             (ticket_id, message_id, uploader_id, uploader_role, bucket_id, storage_path, original_name, mime_type, size_bytes)
           values ($1, $2, $3, 'support', $4, $5, $6, $7, $8)
           returning *`,
          [
            input.ticketId,
            str(message.id),
            input.attachment.uploaderId,
            input.attachment.bucketId,
            input.attachment.storagePath,
            input.attachment.originalName,
            input.attachment.mimeType,
            input.attachment.sizeBytes,
          ],
        );
        attachments = attachmentRows.map(mapAttachment);
      }
      return mapMessage(message, attachments);
    });
  }

  async updateTicket(input: {
    ticketId: UUID;
    actorId: UUID;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
    assignedTo?: UUID | null;
  }): Promise<SupportTicket> {
    const sets: string[] = [];
    const values: SqlParam[] = [];
    const add = (value: SqlParam) => { values.push(value); return `$${values.length}`; };
    if (input.status !== undefined) sets.push(`status = ${add(input.status)}`);
    if (input.priority !== undefined) sets.push(`priority = ${add(input.priority)}`);
    if (input.category !== undefined) sets.push(`category = ${add(input.category)}`);
    if (input.assignedTo !== undefined) sets.push(`assigned_to = ${add(input.assignedTo)}`);
    if (!sets.length) {
      const existing = await this.getForAdmin(input.ticketId);
      if (!existing) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
      return existing;
    }
    values.push(input.ticketId);
    const rows = await this.db.query<Row>(
      `update public.tickets set ${sets.join(', ')}
        where id = $${values.length}
        returning *`,
      values,
    );
    if (!rows[0]) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
    return mapTicket(rows[0]);
  }
}
