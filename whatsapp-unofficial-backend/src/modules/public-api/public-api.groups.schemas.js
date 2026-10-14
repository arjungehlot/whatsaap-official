import { z } from "zod";

const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");
const groupId = z.string().trim().min(8).max(100).refine((value) => value.endsWith("@g.us"), "groupId must end with @g.us");
const accountSelector = z.object({
  channelId: channelId.optional(),
});
const participant = z.string().trim().min(6).max(100);

export const listGroupsSchema = z.object({ query: accountSelector });

export const createGroupSchema = z.object({
  body: accountSelector.extend({
    subject: z.string().trim().min(1).max(100),
    participants: z.array(participant).min(1).max(512),
  }),
});

export const groupDetailSchema = z.object({
  params: z.object({ groupId }),
  query: accountSelector,
});

export const groupLeaveSchema = z.object({
  params: z.object({ groupId }),
  body: accountSelector,
});

export const groupParticipantsSchema = z.object({
  params: z.object({ groupId }),
  body: accountSelector.extend({
    action: z.enum(["add", "remove", "promote", "demote"]),
    participants: z.array(participant).min(1).max(512),
  }),
});
