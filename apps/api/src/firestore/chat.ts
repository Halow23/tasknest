import { Timestamp } from "firebase-admin/firestore";
import { TRPCError } from "@trpc/server";
import { chatGroupsCol, chatMessagesCol, db } from "./db";
import type { ChatGroupDoc, ChatMessageDoc } from "./types";

function toChatGroup(id: string, raw: Record<string, unknown>): ChatGroupDoc {
  const rawReadStates = (raw.readStates as Record<string, { toDate?: () => Date }> | undefined) ?? {};
  const readStates: Record<string, Date> = {};
  for (const [uid, value] of Object.entries(rawReadStates)) {
    if (value && typeof value.toDate === "function") readStates[uid] = value.toDate();
    else if (value instanceof Date) readStates[uid] = value;
  }
  return {
    id,
    workspaceId: raw.workspaceId as string,
    name: raw.name as string,
    memberIds: (raw.memberIds as string[]) ?? [],
    createdBy: raw.createdBy as string,
    readStates,
    createdAt: (raw.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(0),
    updatedAt: (raw.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(0),
  };
}

function toChatMessage(id: string, raw: Record<string, unknown>): ChatMessageDoc {
  return {
    id,
    groupId: raw.groupId as string,
    workspaceId: raw.workspaceId as string,
    authorId: raw.authorId as string,
    authorName: raw.authorName as string,
    body: raw.body as string,
    createdAt: (raw.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(0),
  };
}

async function getGroup(wsId: string, groupId: string): Promise<ChatGroupDoc> {
  const snap = await chatGroupsCol(db(), wsId).doc(groupId).get();
  if (!snap.exists) throw new TRPCError({ code: "NOT_FOUND", message: "Chat group not found." });
  return toChatGroup(snap.id, snap.data() as Record<string, unknown>);
}

function assertGroupMember(group: ChatGroupDoc, uid: string) {
  if (!group.memberIds.includes(uid)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this chat group." });
  }
}

export async function listChatGroups(wsId: string, uid: string) {
  const snap = await chatGroupsCol(db(), wsId)
    .where("memberIds", "array-contains", uid)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  return Promise.all(snap.docs.map(async (doc) => {
    const group = toChatGroup(doc.id, doc.data() as Record<string, unknown>);
    const lastRead = group.readStates[uid] ?? new Date(0);
    const recent = await chatMessagesCol(db(), wsId, group.id)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    let unread = 0;
    let lastMessage: { body: string; authorId: string; createdAt: Date } | null = null;
    const messages: ChatMessageDoc[] = [];
    for (const message of recent.docs) {
      const data = message.data() as Record<string, unknown>;
      const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(0);
      messages.unshift(toChatMessage(message.id, data));
      if (!lastMessage) {
        lastMessage = { body: data.body as string, authorId: data.authorId as string, createdAt };
      }
      if (data.authorId !== uid && createdAt > lastRead) unread += 1;
    }
    return { ...group, unread, lastMessage, messages };
  }));
}

export async function createChatGroup(wsId: string, input: { name: string; createdBy: string }): Promise<ChatGroupDoc> {
  const now = Timestamp.now();
  const data = {
    workspaceId: wsId,
    name: input.name,
    memberIds: [input.createdBy],
    createdBy: input.createdBy,
    readStates: { [input.createdBy]: now },
    createdAt: now,
    updatedAt: now,
  };
  const ref = await chatGroupsCol(db(), wsId).add(data);
  return toChatGroup(ref.id, data as unknown as Record<string, unknown>);
}

export async function getChatGroupIfMember(wsId: string, groupId: string, uid: string): Promise<ChatGroupDoc> {
  const group = await getGroup(wsId, groupId);
  assertGroupMember(group, uid);
  return group;
}

export async function addChatGroupMember(wsId: string, groupId: string, actorId: string, userId: string): Promise<void> {
  const group = await getChatGroupIfMember(wsId, groupId, actorId);
  if (group.createdBy !== actorId) throw new TRPCError({ code: "FORBIDDEN", message: "Only the group creator can manage members." });
  if (group.memberIds.includes(userId)) return;
  await chatGroupsCol(db(), wsId).doc(groupId).update({
    memberIds: [...group.memberIds, userId],
    updatedAt: Timestamp.now(),
  });
}

export async function removeChatGroupMember(wsId: string, groupId: string, actorId: string, userId: string): Promise<void> {
  const group = await getChatGroupIfMember(wsId, groupId, actorId);
  if (group.createdBy !== actorId) throw new TRPCError({ code: "FORBIDDEN", message: "Only the group creator can manage members." });
  if (userId === group.createdBy) throw new TRPCError({ code: "BAD_REQUEST", message: "The group creator cannot be removed." });
  await chatGroupsCol(db(), wsId).doc(groupId).update({
    memberIds: group.memberIds.filter(id => id !== userId),
    updatedAt: Timestamp.now(),
  });
}

export async function listChatMessages(wsId: string, groupId: string, uid: string): Promise<ChatMessageDoc[]> {
  await getChatGroupIfMember(wsId, groupId, uid);
  const snap = await chatMessagesCol(db(), wsId, groupId)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return snap.docs
    .map((d) => toChatMessage(d.id, d.data() as Record<string, unknown>))
    .reverse();
}

export async function sendChatMessage(wsId: string, groupId: string, input: { authorId: string; authorName: string; body: string }): Promise<ChatMessageDoc> {
  const group = await getChatGroupIfMember(wsId, groupId, input.authorId);
  const fs = db();
  const groupRef = chatGroupsCol(fs, wsId).doc(groupId);
  const messageRef = groupRef.collection("messages").doc();
  const now = Timestamp.now();
  const data = {
    groupId,
    workspaceId: wsId,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.body,
    createdAt: now,
  };
  // Merge the sender's read cursor in memory so other members' cursors survive.
  const mergedReadStates = { ...group.readStates, [input.authorId]: now.toDate() };
  const batch = fs.batch();
  batch.set(messageRef, data);
  batch.update(groupRef, { updatedAt: now, readStates: mergedReadStates });
  await batch.commit();
  return toChatMessage(messageRef.id, data as unknown as Record<string, unknown>);
}

export async function markChatGroupRead(wsId: string, groupId: string, uid: string): Promise<void> {
  const group = await getChatGroupIfMember(wsId, groupId, uid);
  const mergedReadStates = { ...group.readStates, [uid]: Timestamp.now().toDate() };
  await chatGroupsCol(db(), wsId).doc(groupId).update({ readStates: mergedReadStates });
}
