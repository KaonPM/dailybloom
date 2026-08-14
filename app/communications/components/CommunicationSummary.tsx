import styles from "../communications.module.css";
import { CommunicationSummaryData } from "../types";

const cards: Array<[keyof CommunicationSummaryData, string]> = [
  ["sentToday", "Sent today"], ["delivered", "Delivered"], ["read", "Read"], ["failed", "Failed"], ["awaiting", "Awaiting delivery"],
];

export default function CommunicationSummary({ summary }: { summary: CommunicationSummaryData }) {
  return <div className={styles.summaryGrid}>{cards.map(([key, label]) => <div className={styles.summaryCard} key={key}><span>{label}</span><strong>{summary[key]}</strong></div>)}</div>;
}
