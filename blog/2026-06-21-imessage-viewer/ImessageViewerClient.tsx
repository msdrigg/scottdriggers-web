import { useCallback, useMemo, useRef, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useColorMode } from "@docusaurus/theme-common";
import {
    openDB,
    listConversations,
    resolveConversation,
    fetchMessages,
    fetchRecoverableMessages,
    fetchAttachments,
} from "./lib/db";
import { buildConversation } from "./lib/model";
import { renderHtml, attachPlaceholders } from "./lib/render";
import { identityFor } from "./lib/identity";
import { conversationToText, downloadText } from "./lib/exportTxt";
import ActivityGraph from "./ActivityGraph";
import styles from "./styles.module.css";

type Stage = "idle" | "opening" | "list" | "loading" | "convo";
type Convo = { addr: string; key: string; services: string; count: number; last: Date | null; first: Date | null };

const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ImessageViewerClient() {
    const { colorMode } = useColorMode();
    const theme = colorMode === "light" ? "light" : "dark";
    const wasmBase = useBaseUrl("/wasm/");

    const dbRef = useRef<any>(null);
    const [stage, setStage] = useState<Stage>("idle");
    const [error, setError] = useState<string>("");
    const [convos, setConvos] = useState<Convo[]>([]);
    const [filter, setFilter] = useState("");
    const [active, setActive] = useState<Convo | null>(null);
    const [tab, setTab] = useState<"messages" | "activity">("messages");

    const [model, setModel] = useState<any>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [html, setHtml] = useState<string>("");

    const locateFile = useCallback((f: string) => wasmBase + f, [wasmBase]);

    const handleFile = useCallback(
        async (file: File) => {
            setError("");
            setStage("opening");
            try {
                const buf = new Uint8Array(await file.arrayBuffer());
                // Quick sanity check: SQLite files start with "SQLite format 3\0".
                const magic = new TextDecoder().decode(buf.slice(0, 15));
                if (magic !== "SQLite format 3") {
                    throw new Error(
                        "That doesn't look like a SQLite database. Make sure you selected chat.db (copied out of ~/Library/Messages)."
                    );
                }
                const db = await openDB(buf, locateFile);
                // Probe for the Messages schema.
                try {
                    db.exec("SELECT 1 FROM message LIMIT 1");
                } catch {
                    throw new Error("This SQLite file isn't a Messages chat.db (no `message` table found).");
                }
                dbRef.current = db;
                const list = listConversations(db) as Convo[];
                setConvos(list);
                setStage("list");
            } catch (e: any) {
                setError(e?.message || String(e));
                setStage("idle");
            }
        },
        [locateFile]
    );

    const openConversation = useCallback(
        async (c: Convo) => {
            const db = dbRef.current;
            if (!db) return;
            setActive(c);
            setTab("messages");
            setStage("loading");
            // Yield a frame so the spinner paints before the (sync) decode work.
            await new Promise((r) => setTimeout(r, 0));
            try {
                const { chats } = resolveConversation(db, [c.addr]);
                const chatRowids = chats.map((x: any) => x.rowid);
                const msgRows = fetchMessages(db, chatRowids);
                const recoverable = fetchRecoverableMessages(db, chatRowids);
                const allRowids = [...msgRows, ...recoverable].map((r: any) => r.rowid);
                const attachmentsByMsg = fetchAttachments(db, allRowids);
                const identity = identityFor(c.addr);
                const m = buildConversation(msgRows, attachmentsByMsg, identity, { recoverable });
                attachPlaceholders(m);
                setModel(m);
                setRows(msgRows);
                setHtml(renderHtml(m, { theme, colWidth: 440, title: identity.name }));
                setStage("convo");
            } catch (e: any) {
                setError(e?.message || String(e));
                setStage("list");
            }
        },
        [theme]
    );

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return convos;
        return convos.filter((c) => identityFor(c.addr).name.toLowerCase().includes(q) || c.addr.toLowerCase().includes(q));
    }, [convos, filter]);

    const onExportTxt = useCallback(() => {
        if (!model || !active) return;
        const name = identityFor(active.addr).name.replace(/[^\w.-]+/g, "_");
        downloadText(`imessage-${name}.txt`, conversationToText(model));
    }, [model, active]);

    const onExportHtml = useCallback(() => {
        if (!html || !active) return;
        const name = identityFor(active.addr).name.replace(/[^\w.-]+/g, "_");
        downloadText(`imessage-${name}.html`, html, "text/html");
    }, [html, active]);

    // ---------- render ----------
    if (stage === "idle" || stage === "opening") {
        return (
            <div className={styles.root}>
                <Dropzone busy={stage === "opening"} onFile={handleFile} />
                {error && <div className={styles.error}>{error}</div>}
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.toolbar}>
                {stage !== "list" && (
                    <button className={styles.back} onClick={() => setStage("list")}>
                        ‹ Conversations
                    </button>
                )}
                <span className={styles.toolbarSpacer} />
                <button
                    className={styles.linkBtn}
                    onClick={() => {
                        dbRef.current?.close?.();
                        dbRef.current = null;
                        setStage("idle");
                        setConvos([]);
                        setActive(null);
                        setModel(null);
                    }}
                >
                    Use a different database
                </button>
            </div>

            {stage === "list" && (
                <div>
                    <input
                        className={styles.search}
                        placeholder={`Search ${convos.length} conversations…`}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <ul className={styles.convoList}>
                        {filtered.map((c) => {
                            const id = identityFor(c.addr);
                            return (
                                <li key={c.key}>
                                    <button className={styles.convoItem} onClick={() => openConversation(c)}>
                                        <span className={styles.avatar}>{id.monogram}</span>
                                        <span className={styles.convoMain}>
                                            <span className={styles.convoName}>{id.name}</span>
                                            <span className={styles.convoMeta}>
                                                {c.count.toLocaleString()} messages
                                                {c.services ? ` · ${c.services}` : ""}
                                            </span>
                                        </span>
                                        <span className={styles.convoDate}>{c.last ? fmtDate.format(c.last) : ""}</span>
                                    </button>
                                </li>
                            );
                        })}
                        {filtered.length === 0 && <li className={styles.empty}>No conversations match “{filter}”.</li>}
                    </ul>
                </div>
            )}

            {stage === "loading" && (
                <div className={styles.center}>
                    <div className={styles.spinner} />
                    <p>Decoding {active ? identityFor(active.addr).name : "conversation"}…</p>
                </div>
            )}

            {stage === "convo" && model && (
                <div>
                    <div className={styles.convoHead}>
                        <div className={styles.tabs}>
                            <button className={tab === "messages" ? styles.tabOn : ""} onClick={() => setTab("messages")}>
                                Messages
                            </button>
                            <button className={tab === "activity" ? styles.tabOn : ""} onClick={() => setTab("activity")}>
                                Activity
                            </button>
                        </div>
                        <div className={styles.exports}>
                            <button onClick={onExportTxt}>Export .txt</button>
                            <button onClick={onExportHtml}>Export .html</button>
                        </div>
                    </div>

                    {tab === "messages" ? (
                        <div className={styles.phone}>
                            <iframe className={styles.phoneFrame} title="Conversation" srcDoc={html} />
                        </div>
                    ) : (
                        <ActivityGraph rows={rows} title={active ? identityFor(active.addr).name : "Conversation"} />
                    )}
                </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
        </div>
    );
}

function Dropzone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
    const [drag, setDrag] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div
            className={`${styles.dropzone} ${drag ? styles.dropOver : ""}`}
            onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
        >
            <input
                ref={inputRef}
                type="file"
                accept=".db,.sqlite,application/octet-stream"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                }}
            />
            {busy ? (
                <>
                    <div className={styles.spinner} />
                    <p>Opening database…</p>
                </>
            ) : (
                <>
                    <div className={styles.dropIcon}>💬</div>
                    <p className={styles.dropTitle}>Drop your chat.db here</p>
                    <p className={styles.dropSub}>or click to choose a file · nothing is uploaded — it stays in your browser</p>
                </>
            )}
        </div>
    );
}
