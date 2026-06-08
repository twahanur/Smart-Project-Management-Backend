import { Router } from "express";
import * as workspaceController from "./workspace.controller";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
} from "./workspace.validation";

const router = Router();

// All workspace routes require authentication
router.use(authenticate);

// GET /api/workspaces — Get my workspaces
router.get("/", workspaceController.getMyWorkspaces);

// POST /api/workspaces — Create a workspace
router.post(
  "/",
  validate(createWorkspaceSchema),
  workspaceController.createWorkspace,
);

// GET /api/workspaces/:id — Get a workspace details
router.get("/:id", workspaceController.getWorkspaceById);

// PATCH /api/workspaces/:id — Update workspace details
router.patch(
  "/:id",
  validate(updateWorkspaceSchema),
  workspaceController.updateWorkspace,
);

// DELETE /api/workspaces/:id — Delete a workspace
router.delete("/:id", workspaceController.deleteWorkspace);

// POST /api/workspaces/:id/members — Add/Invite a member
router.post(
  "/:id/members",
  (req, res, next) => {
    console.log("\n\n\n\n");
    console.log(req.body);
    next();
  },
  validate(addWorkspaceMemberSchema),
  workspaceController.addMember,
);

// PATCH /api/workspaces/:id/members/:userId — Change role of a member
router.patch(
  "/:id/members/:userId",
  validate(updateWorkspaceMemberRoleSchema),
  workspaceController.updateMemberRole,
);

// DELETE /api/workspaces/:id/members/:userId — Remove a member
router.delete("/:id/members/:userId", workspaceController.removeMember);

// POST /api/workspaces/:id/leave — Leave a workspace
router.post("/:id/leave", workspaceController.leaveWorkspace);

export default router;
