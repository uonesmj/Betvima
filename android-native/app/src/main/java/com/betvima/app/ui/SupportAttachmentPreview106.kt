package com.betvima.app.ui

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.betvima.app.BuildConfig
import com.betvima.app.data.SupportAttachment

private val previewBlue = Color(0xFF087FF5)
private val previewInk = Color(0xFF1D2026)

@Composable
internal fun MessengerPendingAttachment(
    uri: Uri,
    filename: String,
    mime: String,
    phase: SupportAttachmentPhase,
    lang: Lang,
    onRemove: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp),
        color = Color.White, shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFFE1E6EE))
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically) {
            if (mime.startsWith("image/")) {
                AsyncImage(
                    model = uri,
                    contentDescription = tr(lang, "Selected image preview", "پیش‌نمایش عکس انتخاب‌شده"),
                    modifier = Modifier.size(53.dp).clip(RoundedCornerShape(9.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(Modifier.size(53.dp).clip(RoundedCornerShape(9.dp))
                    .background(Color(0xFFEBF2FF)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.PictureAsPdf, null, tint = previewBlue)
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(filename, color = previewInk, fontSize = 12.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Text(supportAttachmentPhaseLabel(phase, lang), fontSize = 11.sp,
                    color = when (phase) {
                        SupportAttachmentPhase.FAILED -> Color(0xFFC5344B)
                        SupportAttachmentPhase.UPLOADING -> previewBlue
                        SupportAttachmentPhase.VERIFY -> Color(0xFF9A6A20)
                        SupportAttachmentPhase.READY -> Color(0xFF147A5C)
                    })
            }
            if (phase == SupportAttachmentPhase.UPLOADING) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp,
                    color = previewBlue)
            } else {
                IconButton(onClick = onRemove) {
                    Icon(Icons.Default.Close, tr(lang, "Remove attachment", "حذف پیوست"),
                        tint = Color(0xFF747984), modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

/**
 * Render persisted attachment data from the authenticated server response.
 * The URL is a first-party, owner-checked endpoint. Coil sends the bearer
 * token to BetVima and follows its short-lived signed storage redirect.
 * Private document previews are deliberately excluded from disk/memory caches.
 */
@Composable
internal fun MessengerUploadedAttachment(
    attachment: SupportAttachment,
    ticketId: String,
    token: String?,
    mine: Boolean,
    lang: Lang
) {
    val context = LocalContext.current
    val isImage = attachment.mimeType.startsWith("image/")
    Column(Modifier.padding(top = 7.dp).fillMaxWidth()
        .clip(RoundedCornerShape(12.dp))
        .background(if (mine) Color.White.copy(alpha = .13f) else Color.White)
        .padding(8.dp)) {
        if (isImage && token != null && validSupportNotificationTicketId(ticketId) &&
            validSupportNotificationTicketId(attachment.id)) {
            val request = remember(token, ticketId, attachment.id) {
                ImageRequest.Builder(context)
                    .data(BuildConfig.API_BASE_URL.trimEnd('/') +
                        "/api/v1/support/" + ticketId + "/attachments/" + attachment.id)
                    .addHeader("Authorization", "Bearer " + token)
                    .diskCachePolicy(CachePolicy.DISABLED)
                    .memoryCachePolicy(CachePolicy.DISABLED)
                    .build()
            }
            AsyncImage(
                model = request,
                contentDescription = tr(lang, "Uploaded image", "عکس ارسال‌شده"),
                modifier = Modifier.fillMaxWidth().height(135.dp)
                    .clip(RoundedCornerShape(9.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(Modifier.height(6.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (isImage) Icons.Default.Image else Icons.Default.PictureAsPdf,
                null, tint = if (mine) Color.White else previewBlue,
                modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(attachment.originalName, fontSize = 12.sp,
                color = if (mine) Color.White else previewInk,
                maxLines = 2, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(13.dp),
                tint = if (mine) Color.White else Color(0xFF16835D))
            Spacer(Modifier.width(4.dp))
            Text(tr(lang, "Uploaded", "ارسال شد"), fontSize = 11.sp,
                color = if (mine) Color.White else Color(0xFF16835D))
        }
    }
}
