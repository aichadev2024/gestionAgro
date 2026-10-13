"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Jour = { jour: string; ca: number; nb: number };
type TopProduit = { nom: string; quantite: number; ca: number };
type Mode = { mode: string; montant: number };

const COULEURS_MODES = ["#1f5d34", "#f08a24", "#d6402b", "#8a9a2b"];
const LIBELLE_MODE: Record<string, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  CREDIT: "Crédit",
};

const fcfa = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ")} FCFA`;

export function VentesParJour({ donnees }: { donnees: Jour[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={donnees}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="jour" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={(v) => fcfa(Number(v))} labelFormatter={(l) => `Jour ${l}`} />
        <Bar dataKey="ca" name="Chiffre d'affaires" fill="#1f5d34" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopProduits({ donnees }: { donnees: TopProduit[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, donnees.length * 36)}>
      <BarChart data={donnees} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="nom" tick={{ fontSize: 12 }} width={110} />
        <Tooltip formatter={(v) => fcfa(Number(v))} />
        <Bar dataKey="ca" name="Chiffre d'affaires" fill="#f08a24" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RepartitionPaiements({ donnees }: { donnees: Mode[] }) {
  const data = donnees.map((d) => ({ name: LIBELLE_MODE[d.mode] ?? d.mode, value: d.montant }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COULEURS_MODES[i % COULEURS_MODES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fcfa(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

type PointPeriode = { label: string; ca: number; marge: number; caPrecedent?: number };

/** CA et marge de la période, avec le CA de la période précédente en pointillé. */
export function GraphePeriode({ donnees }: { donnees: PointPeriode[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={donnees}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(v) => fcfa(Number(v))} />
        <Legend />
        <Bar dataKey="ca" name="Chiffre d'affaires" fill="#1f5d34" radius={[4, 4, 0, 0]} />
        <Bar dataKey="marge" name="Marge brute" fill="#f08a24" radius={[4, 4, 0, 0]} />
        <Line
          dataKey="caPrecedent"
          name="CA période précédente"
          stroke="#8a8a8a"
          strokeDasharray="5 4"
          dot={false}
          strokeWidth={2}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
