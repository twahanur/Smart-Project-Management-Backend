import { z } from "zod";
import { WorkspaceRole } from "@prisma/client";

export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Workspace name is required")
      .max(100, "Name cannot exceed 100 characters"),
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .optional(),
    logo_url: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  }),
});

export const updateWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Workspace name is required")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .optional(),
    logo_url: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  }),
});

export const addWorkspaceMemberSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    role: z.nativeEnum(WorkspaceRole).optional(),
  }),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum([WorkspaceRole.admin, WorkspaceRole.project_manager, WorkspaceRole.team_member], {
      errorMap: () => ({ message: "Role must be admin, project_manager or team_member" }),
    }),
  }),
});

export type CreateWorkspaceInput = z.infer<
  typeof createWorkspaceSchema
>["body"];
export type UpdateWorkspaceInput = z.infer<
  typeof updateWorkspaceSchema
>["body"];
export type AddWorkspaceMemberInput = z.infer<
  typeof addWorkspaceMemberSchema
>["body"];
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>["body"];
