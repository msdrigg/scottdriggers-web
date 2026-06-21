import { useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { buildSeries, seriesTotals } from "./lib/series";
import styles from "./styles.module.css";

const SENT = "#0a7cff";
const RECV = "#8e8e93";

type Gran = "day" | "month";
type Kind = "bar" | "line";

function TipBox({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
        <div className={styles.tip}>
            <div className={styles.tipLabel}>{d.label}</div>
            <div className={styles.tipRow}>
                <span>
                    <span className={styles.dot} style={{ background: SENT }} />
                    Sent
                </span>
                <span>{d.sent.toLocaleString()}</span>
            </div>
            <div className={styles.tipRow}>
                <span>
                    <span className={styles.dot} style={{ background: RECV }} />
                    Received
                </span>
                <span>{d.received.toLocaleString()}</span>
            </div>
            <div className={`${styles.tipRow} ${styles.tipTotal}`}>
                <span>Total</span>
                <span>{d.total.toLocaleString()}</span>
            </div>
        </div>
    );
}

export default function ActivityGraph({ rows, title }: { rows: any[]; title: string }) {
    const [gran, setGran] = useState<Gran>("month");
    const [kind, setKind] = useState<Kind>("bar");

    const day = useMemo(() => buildSeries(rows, { by: "day" }), [rows]);
    const month = useMemo(() => buildSeries(rows, { by: "month" }), [rows]);
    const data = gran === "month" ? month : day;
    const totals = useMemo(() => seriesTotals(day.length ? day : month), [day, month]);

    const grand = totals.total || 0;
    const pct = (n: number) => (grand ? Math.round((n / grand) * 100) : 0);
    const range = data.length ? `${data[0].label} – ${data[data.length - 1].label}` : "No messages";
    // Thin the x-axis ticks so long date labels don't overlap.
    const interval = Math.max(0, Math.floor(data.length / 10) - 1);

    return (
        <div className={styles.graph}>
            <div className={styles.graphHead}>
                <div>
                    <h3 className={styles.graphTitle}>{title}</h3>
                    <div className={styles.graphRange}>{range}</div>
                </div>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <div className={styles.statN}>{grand.toLocaleString()}</div>
                        <div className={styles.statL}>Messages</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statN}>{totals.sent.toLocaleString()}</div>
                        <div className={styles.statL}>
                            <span className={styles.dot} style={{ background: SENT }} />
                            Sent · {pct(totals.sent)}%
                        </div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statN}>{totals.received.toLocaleString()}</div>
                        <div className={styles.statL}>
                            <span className={styles.dot} style={{ background: RECV }} />
                            Received · {pct(totals.received)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.controls}>
                {month.length > 0 && day.length > 0 && (
                    <div className={styles.seg}>
                        <button className={gran === "day" ? styles.segOn : ""} onClick={() => setGran("day")}>
                            Per day
                        </button>
                        <button className={gran === "month" ? styles.segOn : ""} onClick={() => setGran("month")}>
                            Per month
                        </button>
                    </div>
                )}
                <div className={styles.seg}>
                    <button className={kind === "bar" ? styles.segOn : ""} onClick={() => setKind("bar")}>
                        Bars
                    </button>
                    <button className={kind === "line" ? styles.segOn : ""} onClick={() => setKind("line")}>
                        Line
                    </button>
                </div>
            </div>

            <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={380}>
                    {kind === "bar" ? (
                        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.18)" vertical={false} />
                            <XAxis dataKey="label" interval={interval} tick={{ fontSize: 11, fill: "#8a8a8e" }} angle={-35} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 11, fill: "#8a8a8e" }} allowDecimals={false} width={48} />
                            <Tooltip content={<TipBox />} cursor={{ fill: "rgba(127,127,127,0.12)" }} />
                            <Bar dataKey="received" stackId="a" fill={RECV} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="sent" stackId="a" fill={SENT} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    ) : (
                        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.18)" vertical={false} />
                            <XAxis dataKey="label" interval={interval} tick={{ fontSize: 11, fill: "#8a8a8e" }} angle={-35} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 11, fill: "#8a8a8e" }} allowDecimals={false} width={48} />
                            <Tooltip content={<TipBox />} />
                            <Line type="monotone" dataKey="received" stroke={RECV} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="sent" stroke={SENT} strokeWidth={2} dot={false} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
