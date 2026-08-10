// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  Actx0Error,
  buildMemoryBatchPayload,
  buildMessageBatchPayload,
  compilePrompt,
  knowledge,
  me,
  Nctx0Client,
  prompt,
  stringifyMeta,
} from "../src/index.js";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_WORKSPACE_ACCESS_KEY,
  DEFAULT_WORKSPACE_ID,
  LocalServer,
} from "./mock-server.js";

let baseUrl = process.env.NCTX0_BASE_URL?.replace(/\/$/, "") ?? "";
let server: LocalServer | null = null;
let client: Nctx0Client;

beforeAll(async () => {
  if (!baseUrl) {
    server = new LocalServer();
    await server.start();
    baseUrl = server.url;
  }
  client = new Nctx0Client({
    baseUrl,
    accessKey: DEFAULT_WORKSPACE_ACCESS_KEY,
    workspaceId: DEFAULT_WORKSPACE_ID,
  });
});

afterAll(async () => {
  client.close();
  if (server) {
    await server.stop();
  }
});

describe("nctx0 client", () => {
  it("health", async () => {
    expect(await client.health()).toEqual({ status: "ok" });
  });

  it("me access key", async () => {
    const principal = await client.me.get();
    expect(principal.principalType).toBe("access_key");
    expect(principal.accessKey.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(principal.accessKey.name).toBe("Agent runtime");
    expect(principal.accessKey.permissions).toContain("CAN_LIST_AGENTS");
  });

  it("me invalid access key", async () => {
    const bad = new Nctx0Client({
      baseUrl,
      accessKey: "bad-access-key",
      workspaceId: DEFAULT_WORKSPACE_ID,
    });
    await expect(bad.me.get()).rejects.toBeInstanceOf(Actx0Error);
  });

  it("standalone me client", async () => {
    const standalone = me({
      accessKey: DEFAULT_WORKSPACE_ACCESS_KEY,
      baseUrl,
    });
    const principal = await standalone.get();
    expect(principal.principalType).toBe("access_key");
  });

  it("knowledge delete", async () => {
    const uploaded = await client.knowledge.upload({
      file: {
        filename: "policy.md",
        content: Buffer.from("# Refund policy"),
        contentType: "text/markdown",
      },
      title: "Refund policy",
      labels: { team: "support" },
    });
    await expect(client.knowledge.delete(uploaded.id)).resolves.toBeUndefined();
  });

  it("knowledge upload dict labels", async () => {
    const uploaded = await client.knowledge.upload({
      file: {
        filename: "policy.md",
        content: Buffer.from("# Refund policy"),
        contentType: "text/markdown",
      },
      title: "Refund policy",
      labels: { team: "support", category: "policy" },
    });
    expect(uploaded.labels).toEqual(["team=support", "category=policy"]);
    await client.knowledge.delete(uploaded.id);
  });

  it("agent list and get", async () => {
    const agents = await client.agent.list();
    expect(agents.total).toBeGreaterThanOrEqual(1);
    expect(agents.agents[0]?.name).toBe("Support bot");
    expect(agents.agents[0]?.configs.memoryPipeline).toBe(false);

    const agent = await client.agent.get(DEFAULT_AGENT_ID);
    expect(agent.id).toBe(DEFAULT_AGENT_ID);
    expect(agent.kind).toBe("unmanaged");
    expect(agent.configs).toEqual({ memoryPipeline: false });
  });

  it("agent create update delete", async () => {
    const created = await client.agent.create({
      name: "Bot",
      description: "Test bot",
    });
    expect(created.name).toBe("Bot");
    expect(created.configs.memoryPipeline).toBe(false);

    const withPipeline = await client.agent.create({
      name: "Memory bot",
      description: "Test bot with memory pipeline",
      configs: { memoryPipeline: true },
    });
    expect(withPipeline.configs.memoryPipeline).toBe(true);

    const updated = await client.agent.update(created.id, {
      name: "Renamed bot",
      description: "Updated description",
      configs: { memoryPipeline: true },
    });
    expect(updated.name).toBe("Renamed bot");
    expect(updated.configs.memoryPipeline).toBe(true);
    await client.agent.delete(created.id);
    await client.agent.delete(withPipeline.id);
  });

  it("document list search upload", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nctx0-"));
    const docPath = join(dir, "policy.md");
    writeFileSync(docPath, "# Refund policy\n30 day window.", "utf8");

    const uploaded = await client.document.upload({
      file: docPath,
      title: "Refund policy",
      labels: { team: "support", category: "policy" },
    });
    expect(uploaded.title).toBe("Refund policy");
    expect(uploaded.status).toBe("processing");

    const listed = await client.document.list();
    expect(listed.total).toBe(1);
    expect(listed.documents[0]?.id).toBe(uploaded.id);

    const results = await client.document.search({
      query: "refund policy",
      labels: { team: "support" },
      limit: 5,
    });
    expect(results.results).toHaveLength(1);
    expect(results.results[0]?.score).toBe(0.87);

    await client.document.delete(uploaded.id);
  });

  it("document exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nctx0-"));
    const docPath = join(dir, "policy.md");
    writeFileSync(docPath, "# Refund policy\n30 day window.", "utf8");
    const labels = { team: "support", category: "policy" };

    expect(await client.document.exists({ file: docPath, labels })).toBeNull();

    const uploaded = await client.document.upload({
      file: docPath,
      title: "Refund policy",
      labels,
    });
    const found = await client.document.exists({ file: docPath, labels });
    expect(found?.id).toBe(uploaded.id);
    expect(found?.checksum).toBe(uploaded.checksum);

    expect(
      await client.document.exists({
        file: docPath,
        labels: { team: "other" },
      }),
    ).toBeNull();

    writeFileSync(docPath, "# Refund policy\nUpdated text.", "utf8");
    expect(await client.document.exists({ file: docPath, labels })).toBeNull();

    await client.document.delete(uploaded.id);
  });

  it("prompt get latest", async () => {
    const p = await client.prompt.getByName("customer-support");
    expect(p.handle).toBe("customer-support");
    expect(p.version).toBe(2);
    expect(p.content).toBe("You are a helpful assistant v2\n{{ctx}}");
  });

  it("prompt get with version", async () => {
    const p = await client.prompt.getByName("customer-support", { version: "v1" });
    expect(p.version).toBe(1);
    expect(p.content).toBe("You are a helpful assistant v1\n{{ctx}}");
  });

  it.each(["latest", "production"])("prompt get named version %s", async (version) => {
    const p = await client.prompt.getByName("customer-support", { version });
    expect(p.handle).toBe("customer-support");
    if (version === "latest") {
      expect(p.version).toBe(2);
    } else {
      expect(p.version).toBe(1);
    }
  });

  it("prompt compile", async () => {
    const p = await client.prompt.getByName("customer-support");
    expect(compilePrompt(p.content, { ctx: "Ahmed" })).toBe(
      "You are a helpful assistant v2\nAhmed",
    );
  });

  it("prompt get requires workspace", async () => {
    const bare = new Nctx0Client({
      accessKey: DEFAULT_WORKSPACE_ACCESS_KEY,
      baseUrl,
    });
    await expect(bare.prompt.getByName("customer-support")).rejects.toThrow(/workspaceId/);
  });

  it("standalone prompt client", async () => {
    const standalone = prompt({
      baseUrl,
      accessKey: DEFAULT_WORKSPACE_ACCESS_KEY,
      workspaceId: DEFAULT_WORKSPACE_ID,
    });
    const fetched = await standalone.getByName("customer-support");
    expect(fetched.version).toBe(2);
  });

  it("prompt crud and versions", async () => {
    const created = await client.prompt.create({
      name: "Mara Guide",
      type: "text",
      content: "You know Mara Ellison.",
      description: "Answers questions about Mara",
      config: { tone: "friendly" },
      commitMessage: "initial",
      meta: { source: "examples" },
    });
    expect(created.name).toBe("Mara Guide");
    expect(created.handle).toBe("mara-guide");
    expect(created.versionCount).toBe(1);

    const fetched = await client.prompt.get(created.promptId);
    expect(fetched.promptId).toBe(created.promptId);

    const listed = await client.prompt.list();
    expect(listed.prompts.some((item) => item.promptId === created.promptId)).toBe(true);

    const version = await client.prompt.createVersion(created.promptId, {
      type: "text",
      content: "You know Mara Ellison well.",
      commitMessage: "v2",
      production: true,
    });
    expect(version.version).toBe(2);
    expect(version.production).toBe(true);

    const versions = await client.prompt.listVersions(created.promptId);
    expect(versions.total).toBe(2);

    const got = await client.prompt.getVersion(created.promptId, version.id);
    expect(got.content).toBe("You know Mara Ellison well.");

    const updated = await client.prompt.updateVersion(created.promptId, version.id, {
      content: "You know Mara Ellison very well.",
      status: "active",
      production: true,
    });
    expect(updated.content).toBe("You know Mara Ellison very well.");

    const byName = await client.prompt.getByName("mara-guide", { version: "production" });
    expect(byName.id).toBe(version.id);

    await client.prompt.deleteVersion(created.promptId, version.id);
    await client.prompt.delete(created.promptId);
  });

  it.each([
    "agent",
    "document",
    "knowledge",
    "me",
    "memory",
    "message",
    "prompt",
    "session",
  ] as const)("resources share client config (%s)", (attr) => {
    const resource = client[attr];
    expect(resource.sharedKey).toBe(client.agent.sharedKey);
  });

  it("sends access key header", async () => {
    const wrong = new Nctx0Client({ accessKey: "wrong-key", baseUrl });
    await expect(wrong.me.get()).rejects.toBeInstanceOf(Actx0Error);
  });

  it("standalone knowledge client", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nctx0-"));
    const docPath = join(dir, "notes.txt");
    writeFileSync(docPath, "hello", "utf8");

    const standalone = knowledge({
      baseUrl,
      accessKey: DEFAULT_WORKSPACE_ACCESS_KEY,
      workspaceId: DEFAULT_WORKSPACE_ID,
    });
    const uploaded = await standalone.upload({ file: docPath, title: "Notes" });
    expect(uploaded.status).toBe("processing");
    await standalone.delete(uploaded.id);
  });

  it("session flow", async () => {
    const created = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-123",
      title: "Support chat",
    });
    expect(created.externalId).toBe("thread-123");
    expect(created.title).toBe("Support chat");

    const fetched = await client.session.get(DEFAULT_AGENT_ID, created.id);
    expect(fetched.id).toBe(created.id);

    const byLabels = await client.session.getByLabels(DEFAULT_AGENT_ID, {
      externalId: "thread-123",
    });
    expect(byLabels.id).toBe(created.id);

    const listed = await client.session.list(DEFAULT_AGENT_ID);
    expect(listed.total).toBe(1);

    const updated = await client.session.update(DEFAULT_AGENT_ID, {
      externalId: "thread-123",
      title: "Renamed chat",
      newLabels: { userId: "42" },
    });
    expect(updated.title).toBe("Renamed chat");
    expect(updated.labels).toEqual({ userId: "42" });
  });

  it("message flow", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-msg",
    });
    const sessionId = session.id;

    const msg = await client.message.create(DEFAULT_AGENT_ID, sessionId, {
      role: "user",
      content: "Hello",
      meta: { source: "test", channel: "web" },
    });
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello");
    expect(msg.meta).toEqual({ source: "test", channel: "web" });

    const listed = await client.message.list(DEFAULT_AGENT_ID, sessionId);
    expect(listed.total).toBe(1);
    expect(listed.messages[0]?.id).toBe(msg.id);

    const fetched = await client.message.get(DEFAULT_AGENT_ID, sessionId, msg.id);
    expect(fetched.content).toBe("Hello");

    const updated = await client.message.update(DEFAULT_AGENT_ID, sessionId, msg.id, {
      content: "Updated",
      role: "assistant",
      meta: { source: "test", edited: true },
    });
    expect(updated.content).toBe("Updated");
    expect(updated.role).toBe("assistant");
    expect(updated.meta).toEqual({ source: "test", edited: true });

    await client.message.delete(DEFAULT_AGENT_ID, sessionId, msg.id);
  });

  it("message batch create", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-msg-batch",
    });
    const sessionId = session.id;

    const created = await client.message.create(DEFAULT_AGENT_ID, sessionId, [
      {
        role: "user",
        content: "Hello",
        meta: { source: "batch", channel: "web" },
      },
      {
        role: "assistant",
        content: "Hi there",
        meta: { model: "gpt-4", tokens: 12 },
      },
    ]);
    expect(created).toHaveLength(2);
    expect(created[0]?.meta).toEqual({ source: "batch", channel: "web" });
    expect(created[1]?.meta).toEqual({ model: "gpt-4", tokens: 12 });

    await client.message.delete(
      DEFAULT_AGENT_ID,
      sessionId,
      created.map((m) => m.id),
    );
    expect((await client.message.list(DEFAULT_AGENT_ID, sessionId)).total).toBe(0);
  });

  it("message add", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-msg-add",
    });
    const created = await client.message.create(DEFAULT_AGENT_ID, session.id, [
      { role: "user", content: "I'm a vegetarian and allergic to nuts." },
      {
        role: "assistant",
        content: "Got it! I'll remember your dietary preferences.",
      },
    ]);
    expect(created).toHaveLength(2);

    const listed = await client.message.list(DEFAULT_AGENT_ID, session.id);
    expect(listed.total).toBe(2);
    expect(listed.messages.map((m) => m.id)).toEqual(created.map((m) => m.id));
  });

  it("message search", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-msg-search",
    });
    const created = await client.message.create(DEFAULT_AGENT_ID, session.id, [
      { role: "user", content: "Let's revisit the pricing discussion." },
      { role: "assistant", content: "The trial starts next week." },
    ]);

    const results = await client.message.search(DEFAULT_AGENT_ID, session.id, {
      query: "pricing discussion",
      limit: 1,
    });
    expect(results.results).toHaveLength(1);
    expect(results.results[0]?.id).toBe(created[0]?.id);
    expect(results.results[0]?.role).toBe("user");
    expect(results.results[0]?.score).toBe(0.91);
    expect(results.results[0]?.text).toBe("Let's revisit the pricing discussion.");
  });

  it("memory flow", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-mem",
    });
    const sessionId = session.id;

    const mem = await client.memory.create(DEFAULT_AGENT_ID, sessionId, {
      kind: "fact",
      content: "User is in Cairo",
      meta: { confidence: 0.9, source: "onboarding" },
    });
    expect(mem.kind).toBe("fact");
    expect(mem.content).toBe("User is in Cairo");
    expect(mem.meta).toEqual({ confidence: 0.9, source: "onboarding" });

    const listed = await client.memory.list(DEFAULT_AGENT_ID, sessionId);
    expect(listed.total).toBe(1);

    const fetched = await client.memory.get(DEFAULT_AGENT_ID, sessionId, mem.id);
    expect(fetched.content).toBe("User is in Cairo");

    const updated = await client.memory.update(DEFAULT_AGENT_ID, sessionId, mem.id, {
      content: "User is in Cairo, Egypt",
      meta: { confidence: 0.95, verified: true },
    });
    expect(updated.content).toBe("User is in Cairo, Egypt");
    expect(updated.meta).toEqual({ confidence: 0.95, verified: true });

    await client.memory.delete(DEFAULT_AGENT_ID, sessionId, mem.id);
  });

  it("memory batch create", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-mem-batch",
    });
    const sessionId = session.id;

    const created = await client.memory.create(DEFAULT_AGENT_ID, sessionId, [
      {
        kind: "fact",
        content: "User prefers dark mode",
        meta: { confidence: 0.95, source: "onboarding" },
      },
      { kind: "summary", content: "Discussed billing setup" },
    ]);
    expect(created).toHaveLength(2);
    expect(created[0]?.meta).toEqual({ confidence: 0.95, source: "onboarding" });
    expect(created[1]?.meta).toEqual({});

    await client.memory.delete(
      DEFAULT_AGENT_ID,
      sessionId,
      created.map((m) => m.id),
    );
    expect((await client.memory.list(DEFAULT_AGENT_ID, sessionId)).total).toBe(0);
  });

  it("memory search", async () => {
    const session = await client.session.create(DEFAULT_AGENT_ID, {
      externalId: "thread-mem-search",
    });
    const created = await client.memory.create(DEFAULT_AGENT_ID, session.id, [
      { kind: "preference", content: "User preferences include dark mode." },
      { kind: "fact", content: "User is in Cairo." },
    ]);

    const results = await client.memory.search(DEFAULT_AGENT_ID, session.id, {
      query: "user preferences",
    });
    expect(results.results).toHaveLength(1);
    expect(results.results[0]?.id).toBe(created[0]?.id);
    expect(results.results[0]?.kind).toBe("preference");
    expect(results.results[0]?.score).toBe(0.88);
    expect(results.results[0]?.text).toBe("User preferences include dark mode.");
  });

  it("meta helpers", () => {
    expect(stringifyMeta({ source: "sdk" })).toBe('{"source":"sdk"}');
    expect(stringifyMeta(null)).toBeNull();

    const messagePayload = buildMessageBatchPayload([
      { role: "user", content: "Hi", meta: { source: "import" } },
    ]);
    expect(messagePayload.messages[0]?.meta).toBe('{"source":"import"}');

    const memoryPayload = buildMemoryBatchPayload([
      { kind: "fact", content: "Prefers dark mode", meta: { source: "import" } },
    ]);
    expect(memoryPayload.memories[0]?.meta).toBe('{"source":"import"}');
  });

  it("session delete", async () => {
    await client.session.create(DEFAULT_AGENT_ID, { externalId: "thread-del" });
    await client.session.delete(DEFAULT_AGENT_ID, { externalId: "thread-del" });
    await expect(
      client.session.getByLabels(DEFAULT_AGENT_ID, { externalId: "thread-del" }),
    ).rejects.toBeInstanceOf(Actx0Error);
  });
});
