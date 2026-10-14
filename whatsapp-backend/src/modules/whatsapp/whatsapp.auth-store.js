import { BufferJSON, initAuthCreds, makeCacheableSignalKeyStore, proto } from "@whiskeysockets/baileys";
import { WhatsAppAuthStateModel } from "../../models/WhatsAppAuthState.js";

const CREDS_TYPE = "creds";
const CREDS_KEY = "creds";

function serialize(value) {
  return JSON.stringify(value, BufferJSON.replacer);
}

function deserialize(value) {
  return JSON.parse(value, BufferJSON.reviver);
}

async function readAuthValue(accountId, type, key) {
  const row = await WhatsAppAuthStateModel.findOne({ accountId, type, key }).lean();
  return row ? deserialize(row.value) : null;
}

async function writeAuthValue(accountId, type, key, value) {
  await WhatsAppAuthStateModel.updateOne(
    { accountId, type, key },
    { $set: { value: serialize(value) } },
    { upsert: true },
  );
}

export async function useMongoAuthState(accountId) {
  const creds = (await readAuthValue(accountId, CREDS_TYPE, CREDS_KEY)) || initAuthCreds();
  const keys = {
    async get(type, ids) {
      const rows = await WhatsAppAuthStateModel.find({
        accountId,
        type,
        key: { $in: ids },
      }).lean();

      const data = {};
      for (const row of rows) {
        let value = deserialize(row.value);
        if (type === "app-state-sync-key" && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        data[row.key] = value;
      }

      return data;
    },
    async set(data) {
      const operations = [];

      for (const type of Object.keys(data)) {
        for (const key of Object.keys(data[type])) {
          const value = data[type][key];
          const filter = { accountId, type, key };

          operations.push(
            value
              ? {
                  updateOne: {
                    filter,
                    update: { $set: { value: serialize(value) } },
                    upsert: true,
                  },
                }
              : { deleteOne: { filter } },
          );
        }
      }

      if (operations.length > 0) {
        await WhatsAppAuthStateModel.bulkWrite(operations, { ordered: false });
      }
    },
    async clear() {
      await clearMongoAuthState(accountId);
    },
  };

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore(keys),
    },
    saveCreds() {
      return writeAuthValue(accountId, CREDS_TYPE, CREDS_KEY, creds);
    },
  };
}

export async function clearMongoAuthState(accountId) {
  await WhatsAppAuthStateModel.deleteMany({ accountId });
}

export async function hasMongoAuthState(accountId) {
  return WhatsAppAuthStateModel.exists({ accountId, type: CREDS_TYPE, key: CREDS_KEY });
}

export async function getPhoneJidForLid(accountId, lidJid) {
  const [lidUserWithDevice, server] = String(lidJid || "").split("@");
  if (server !== "lid" || !lidUserWithDevice) return null;

  const lidUser = lidUserWithDevice.split(":")[0].split("_")[0];
  const pnUser = await readAuthValue(accountId, "lid-mapping", `${lidUser}_reverse`);

  return pnUser ? `${pnUser}@s.whatsapp.net` : null;
}
