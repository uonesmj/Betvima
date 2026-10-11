/**
 * SERVICE CONTAINER - one place where adapters are wired to services.
 * Everything is constructed per request from the process-wide Db; no service holds
 * mutable global state, and no service can be constructed without an explicit Db,
 * so tests can inject a real database instead of mocking.
 */
import type { Db } from '@/lib/ports/db';
import type {
  AdminRepository, AffiliateRepository, BettingRepository, CatalogRepository, JobRepository,
  NotificationRepository, PaymentRepository, UserRepository, WalletRepository, BonusRepository, SupportRepository,
} from '@/lib/ports/repositories';
import { getDb } from '@/server/db';
import { PostgresCatalogRepository } from '@/server/adapters/postgres/catalog';
import { PostgresBettingRepository } from '@/server/adapters/postgres/betting';
import { PostgresWalletRepository } from '@/server/adapters/postgres/wallet';
import { PostgresAffiliateRepository } from '@/server/adapters/postgres/affiliate';
import { PostgresPaymentRepository } from '@/server/adapters/postgres/payments';
import { PostgresUserRepository } from '@/server/adapters/postgres/users';
import { PostgresNotificationRepository } from '@/server/adapters/postgres/notifications';
import { PostgresAdminRepository } from '@/server/adapters/postgres/admin';
import { PostgresSupportRepository } from '@/server/adapters/postgres/support';
import { PostgresJobRepository } from '@/server/adapters/postgres/jobs';
import { PostgresBonusRepository } from '@/server/adapters/postgres/bonuses';
import { SettlementService } from './settlement-service';
import { BettingService } from './betting-service';
import { PaymentService } from './payment-service';
import { NotificationService } from './notification-service';
import { providers } from '@/providers/null-providers';
import { createDomainAdapters } from '@/server/adapters/domain-bridge';
import type { SettlementPort } from '@/domain/ports';

/**
 * Services are exposed through their PORTS, not the concrete classes, so nothing outside
 * the adapter layer can depend on a Postgres detail.
 */
export interface Services {
  db: Db;
  catalog: CatalogRepository;
  betting: BettingRepository;
  wallet: WalletRepository;
  bonuses: BonusRepository;
  affiliate: AffiliateRepository;
  payments: PaymentRepository;
  users: UserRepository;
  notifications: NotificationRepository;
  admin: AdminRepository;
  support: SupportRepository;
  jobs: JobRepository;
  settlement: SettlementService;
  /** Domain settlement port: the authoritative nova.settlement_jobs queue and atomic settle calls. */
  settlementPort: SettlementPort;
  bettingService: BettingService;
  paymentsService: PaymentService;
  notificationsService: NotificationService;
  providers: ReturnType<typeof providers>;
}

export function createServices(db: Db = getDb()): Services {
  const catalog = new PostgresCatalogRepository(db);
  const betting = new PostgresBettingRepository(db);
  const wallet = new PostgresWalletRepository(db);
  const bonuses = new PostgresBonusRepository(db);
  const affiliate = new PostgresAffiliateRepository(db);
  const payments = new PostgresPaymentRepository(db);
  const users = new PostgresUserRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  const admin = new PostgresAdminRepository(db);
  const support = new PostgresSupportRepository(db);
  const jobs = new PostgresJobRepository(db);
  const providersRegistry = providers();
  const settlement = new SettlementService({ db, betting, catalog });
  const domain = createDomainAdapters(db);

  // Two-phase build: services reference each other through this object.
  const services: Services = {
    db, catalog, betting, wallet, bonuses, affiliate, payments, users, notifications, admin, support, jobs,
    settlement, settlementPort: domain.settlement, providers: providersRegistry,
    bettingService: undefined as unknown as BettingService,
    paymentsService: undefined as unknown as PaymentService,
    notificationsService: undefined as unknown as NotificationService,
  };
  services.bettingService = new BettingService(services);
  services.paymentsService = new PaymentService(services);
  services.notificationsService = new NotificationService(services);
  return services;
}
