"use client";

import { useState } from "react";
import { FOLLOW_UP_DAYS, type Contact, type OutreachStatus } from "@/lib/anusha-companies-shared";
import { Avatar, shortDate } from "./bits";

const LABEL_TAGS: Record<string, { text: string; cls: string }> = {
  hiring_manager: { text: "Hiring manager", cls: "ac-tag-hm" },
  referrer: { text: "Could refer you", cls: "ac-tag-ref" },
  recruiter: { text: "Recruiter", cls: "ac-tag-rec" },
};

// One step back from each status, for "Undo".
const PREVIOUS: Record<OutreachStatus, OutreachStatus | null> = {
  messaged: null,
  replied: "messaged",
  call: "replied",
  not_interested: "messaged",
};

interface Props {
  contact: Contact;
  onSave: (contactId: string, update: { status: OutreachStatus | null; notes?: string }) => Promise<void>;
}

export default function ContactCard({ contact, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(contact.outreach?.notes || "");
  const o = contact.outreach;
  const label = LABEL_TAGS[contact.label];

  async function save(status: OutreachStatus | null, notes?: string) {
    setSaving(true);
    try {
      await onSave(contact.id, { status, notes });
    } finally {
      setSaving(false);
    }
  }

  const followUpDue =
    o?.status === "messaged" && !!o.messagedAt &&
    Date.now() - new Date(o.messagedAt).getTime() > FOLLOW_UP_DAYS * 86400000;

  return (
    <div className={contact.label === "not_relevant" ? "ac-person ac-muted-card" : "ac-person"}>
      <div className="ac-who">
        <Avatar name={contact.name} />
        <div className="ac-who-text">
          <b>{contact.name}</b>
          <span>{contact.currentRole || contact.headline}</span>
        </div>
      </div>

      <div className="ac-tags">
        {label && <span className={`ac-tag ${label.cls}`}>{label.text}</span>}
        {contact.isAlumni && <span className="ac-tag ac-tag-alum">🎓 Ex-Bharat Biotech</span>}
        {contact.degree === "1st" && <span className="ac-tag ac-tag-warm">🤝 Ashmit knows them</span>}
        {contact.degree === "2nd" && <span className="ac-tag ac-tag-warm">🤝 Mutual via Ashmit</span>}
      </div>

      {contact.reason && <div className="ac-reason">{contact.reason}</div>}

      <div className="ac-actions">
        <a className="ac-btn ac-btn-ghost" href={contact.profileUrl} target="_blank" rel="noreferrer">
          Open profile ↗
        </a>
        {!o && (
          <button className="ac-btn ac-btn-primary" disabled={saving} onClick={() => save("messaged")}>
            I messaged
          </button>
        )}
        {o?.status === "messaged" && (
          <>
            <span className={followUpDue ? "ac-status ac-status-due" : "ac-status ac-status-messaged"}>
              {followUpDue ? "⏰ Follow up" : "✓ Messaged"} · {shortDate(o.messagedAt)}
            </span>
            <button className="ac-btn ac-btn-ghost" disabled={saving} onClick={() => save("replied")}>They replied</button>
            <button className="ac-btn ac-btn-ghost" disabled={saving} onClick={() => save("not_interested")}>No luck</button>
          </>
        )}
        {o?.status === "replied" && (
          <>
            <span className="ac-status ac-status-replied">💬 Replied · {shortDate(o.statusAt)}</span>
            <button className="ac-btn ac-btn-ghost" disabled={saving} onClick={() => save("call")}>Call scheduled</button>
          </>
        )}
        {o?.status === "call" && <span className="ac-status ac-status-call">📞 Call scheduled · {shortDate(o.statusAt)}</span>}
        {o?.status === "not_interested" && <span className="ac-status ac-status-not_interested">Not interested</span>}
      </div>

      {o && (
        <div className="ac-actions">
          <button className="ac-undo" disabled={saving} onClick={() => save(PREVIOUS[o.status])}>Undo</button>
          {!noteOpen && (
            <button className="ac-undo" onClick={() => setNoteOpen(true)}>{o.notes ? "Edit note" : "Add note"}</button>
          )}
        </div>
      )}
      {o && !noteOpen && o.notes && <div className="ac-reason">📝 {o.notes}</div>}
      {o && noteOpen && (
        <textarea
          className="ac-note"
          autoFocus
          value={note}
          placeholder="e.g. Sent via LinkedIn, mentioned the CDMO thesis"
          onChange={(e) => setNote(e.target.value)}
          onBlur={async () => {
            setNoteOpen(false);
            if (note !== (o.notes || "")) await save(o.status, note);
          }}
        />
      )}
    </div>
  );
}
