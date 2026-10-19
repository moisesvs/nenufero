import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export const DATA_DIR = join(process.cwd(), "data");
export const UPLOAD_DIR = join(DATA_DIR, "uploads");
let mutations = Promise.resolve();

export async function prepareStorage() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  for (const file of ["orders.json", "requests.json", "uploads.json", "processed-events.json"]) {
    try { await readFile(join(DATA_DIR, file), "utf8"); }
    catch { await writeFile(join(DATA_DIR, file), "[]\n", { flag: "wx" }).catch(() => {}); }
  }
}

async function readCollection(name) {
  try {
    const parsed = JSON.parse(await readFile(join(DATA_DIR, name), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function mutateCollection(name, mutator) {
  const task = mutations.then(async () => {
    const rows = await readCollection(name);
    const result = await mutator(rows);
    const target = join(DATA_DIR, name);
    const temporary = join(DATA_DIR, `${name}.${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
    return result;
  });
  mutations = task.catch(() => {});
  return task;
}

export function createOrder(order) {
  return mutateCollection("orders.json", (orders) => {
    orders.push(order);
    return order;
  });
}

export function findOrder(id) {
  return readCollection("orders.json").then((orders) => orders.find((order) => order.id === id) || null);
}

export function updateOrder(id, updater) {
  return mutateCollection("orders.json", (orders) => {
    const index = orders.findIndex((order) => order.id === id);
    if (index < 0) return null;
    orders[index] = updater(orders[index]);
    return orders[index];
  });
}

export function createRequest(request) {
  return mutateCollection("requests.json", (requests) => {
    requests.push(request);
    return request;
  });
}

export function getUpload(id) {
  return readCollection("uploads.json").then((uploads) => uploads.find((upload) => upload.id === id) || null);
}

export function saveUpload({ fileName, mime, buffer }) {
  const id = randomUUID();
  const extension = extname(fileName).toLowerCase();
  return mutateCollection("uploads.json", async (uploads) => {
    const path = join(UPLOAD_DIR, `${id}${extension}`);
    await writeFile(path, buffer, { flag: "wx", mode: 0o600 });
    const upload = { id, fileName, mime, bytes: buffer.length, path, createdAt: new Date().toISOString() };
    uploads.push(upload);
    return upload;
  });
}

export function markEventProcessed(eventId) {
  return mutateCollection("processed-events.json", (events) => {
    if (events.includes(eventId)) return false;
    events.push(eventId);
    if (events.length > 10000) events.splice(0, events.length - 10000);
    return true;
  });
}
