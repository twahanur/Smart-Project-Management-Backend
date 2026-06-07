import fs from 'fs';
import path from 'path';
import streamifier from 'streamifier';
import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Ensure uploads directory exists for local fallback
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const uploadAttachment = async (
  cardId: string,
  userId: string,
  file: Express.Multer.File
) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  }

  let fileUrl = '';
  let publicId: string | null = null;

  if (isCloudinaryConfigured) {
    // Cloudinary upload
    fileUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'project_management_attachments',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(new AppError('Cloudinary upload failed', 500, 'UPLOAD_ERROR'));
          if (result) {
            publicId = result.public_id;
            resolve(result.secure_url);
          }
        }
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  } else {
    // Local disk fallback
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, file.buffer);

    const port = process.env.PORT || 5000;
    const clientUrl = process.env.CLIENT_URL || `http://localhost:${port}`;
    fileUrl = `${clientUrl}/uploads/${filename}`;
  }

  const attachment = await prisma.attachment.create({
    data: {
      card_id: cardId,
      uploaded_by: userId,
      file_name: file.originalname,
      file_url: fileUrl,
      public_id: publicId,
      file_size: file.size,
      mime_type: file.mimetype,
    },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: 'updated',
    entity_type: 'card',
    entity_id: cardId,
    description: `attached file "${file.originalname}" to card "${card.title}"`,
  });

  return attachment;
};

export const deleteAttachment = async (attachmentId: string, userId: string, userRole: string) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { card: true },
  });

  if (!attachment) {
    throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
  }

  // Authorize deletion
  const isUploader = attachment.uploaded_by === userId;
  const isAdmin = userRole === 'admin';

  if (!isUploader && !isAdmin) {
    const boardMember = await prisma.boardMember.findUnique({
      where: { board_id_user_id: { board_id: attachment.card.board_id, user_id: userId } },
    });
    const isBoardAdmin = boardMember?.role === 'admin';

    if (!isBoardAdmin) {
      throw new AppError('Access denied. Only the uploader or board administrators can delete attachments.', 403, 'ACCESS_DENIED');
    }
  }

  // Delete physical file
  if (attachment.public_id) {
    // Delete from Cloudinary
    await new Promise<void>((resolve) => {
      cloudinary.uploader.destroy(attachment.public_id!, { resource_type: 'image' }, () => {
        resolve();
      });
    });
  } else {
    // Delete from local disk
    const filename = path.basename(attachment.file_url);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('[AttachmentService] Failed to delete file locally:', err);
      }
    }
  }

  // Delete from DB
  await prisma.attachment.delete({ where: { id: attachmentId } });

  await logActivity({
    userId,
    boardId: attachment.card.board_id,
    cardId: attachment.card_id,
    action_type: 'updated',
    entity_type: 'card',
    entity_id: attachment.card_id,
    description: `removed attachment "${attachment.file_name}"`,
  });
};
