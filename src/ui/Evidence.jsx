import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

const labels = { verified: "Verifierad", partially_verified: "Delvis verifierad", observed: "Annonsuppgift", modelled: "Modellberäknad", estimated: "Estimerad", incomplete: "Ofullständig", missing: "Saknas" };

export function Evidence({ evidence }) {
  const value = evidence?.status || "missing";
  const good = value === "verified" || value === "observed";
  return <span className={`evidence-pill ${good ? "good" : "estimate"}`}>{good ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{labels[value] || value}</span>;
}
