import { z } from "zod";

export const inviteTeamMemberSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  role: z.enum(["admin", "advisor"]).default("advisor"),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
