import { Router } from 'express';
import * as customFieldController from './customField.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess, boardAdmin } from '../../middlewares/boardAccess';
import { createCustomFieldSchema, setCustomFieldValueSchema } from './customField.validation';

const router = Router({ mergeParams: true }); // Merge params to access boardId

router.use(authenticate);
router.use(boardAccess);

// Definitions routes
router.get('/', customFieldController.getBoardCustomFields);
router.post('/', boardAdmin, validate(createCustomFieldSchema), customFieldController.createCustomField);
router.delete('/:id', boardAdmin, customFieldController.deleteCustomField);

// Card specific values
router.get('/cards/:cardId/values', customFieldController.getCardCustomFieldValues);
router.post(
  '/cards/:cardId/fields/:fieldId',
  validate(setCustomFieldValueSchema),
  customFieldController.setCardCustomFieldValue
);

export default router;
