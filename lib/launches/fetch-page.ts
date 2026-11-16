// Fetches a visitor's product page for its metadata. The URL is untrusted, so every connection
// resolves DNS itself and refuses private, loopback and link-local addresses (checked at connect
// time, so a rebinding DNS answer can't slip past an earlier check), redirects are followed by
// hand and re-checked, and the body is capped in size and time.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { checkUrl, LaunchError } from "./url";

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(addr, prefix, "ipv4");
// No ::ffff:0:0/96 rule: BlockList checks IPv4 as IPv4-mapped IPv6, so that rule would match every
// IPv4 address. The IPv4 rules above already cover mapped forms like ::ffff:127.0.0.1.
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(addr, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = net.isIPv4(address) ? "ipv4" : net.isIPv6(address) ? "ipv6" : null;
  return !!family && !blocked.check(address, family);
}

/** dns.lookup that only ever hands the socket a public address. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const ok = addresses.filter(a => isPublicAddress(a.address));
    if (!ok.length || ok.length !== addresses.length) {
      return callback(Object.assign(new Error("private address"), { code: "EPRIVATE" }), "", 4);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, ok);
    callback(null, ok[0].address, ok[0].family);
  });
};

export type FetchedPage = { finalUrl: URL; html: string };

function once(url: URL, deadline: number): Promise<{ status: number; location?: string; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.get(
      url,
      {
        lookup: safeLookup,
        timeout: Math.max(1, deadline - Date.now()),
        headers: {
          "User-Agent": "IndieMachineLaunchBot/1.0 (+https://indie-machine.com)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      res => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, type, body: "" });
        }
        if (status < 200 || status >= 300 || !/html/i.test(type)) {
          res.resume();
          return resolve({ status, type, body: "" });
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        const chunks: Buffer[] = [];
        let size = 0;
        // Only the <head> matters, so a page bigger than the cap is cut off rather than refused.
        const finish = () => resolve({ status, type, body: Buffer.concat(chunks).toString("utf8") });
        stream.on("data", (c: Buffer) => {
          size += c.length;
          chunks.push(c);
          if (size >= MAX_BYTES) {
            req.destroy();
            finish();
          }
        });
        stream.on("end", finish);
        stream.on("error", reject);
      },
    );
    const timer = setTimeout(() => req.destroy(new Error("timeout")), Math.max(1, deadline - Date.now()));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.on("close", () => clearTimeout(timer));
  });
}

export async function fetchPage(start: URL): Promise<FetchedPage> {
  const deadline = Date.now() + TIMEOUT_MS;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    checkUrl(url);
    let res;
    try {
      res = await once(url, deadline);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "EPRIVATE") throw new LaunchError(400, "invalid", "That domain points at a private network address.");
      if (code === "ENOTFOUND") throw new LaunchError(400, "unreachable", `${url.hostname} doesn't resolve. Check the domain.`);
      throw new LaunchError(400, "unreachable", `Couldn't load ${url.hostname} (${(e as Error).message}).`);
    }
    if (res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        throw new LaunchError(400, "unreachable", "The page redirects somewhere invalid.");
      }
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new LaunchError(400, "unreachable", `${url.hostname} answered with HTTP ${res.status}.`);
    if (!res.body) throw new LaunchError(400, "unreachable", "That URL isn't a web page.");
    return { finalUrl: url, html: res.body };
  }
  throw new LaunchError(400, "unreachable", "Too many redirects.");
}
