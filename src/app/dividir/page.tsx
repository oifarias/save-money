import type { Metadata } from "next";
import { getSplitByToken } from "@/lib/split-data";
import { PublicSplitNotFound, PublicSplitView } from "@/components/split/public-split-view";

export const metadata: Metadata = {
  title: "Conta dividida — Save Money",
};

type DividirPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DividirPage({ searchParams }: DividirPageProps) {
  const rawSearchParams = await searchParams;
  const token = typeof rawSearchParams.token === "string" ? rawSearchParams.token : undefined;

  const split = token ? await getSplitByToken(token) : null;

  if (!split) {
    return <PublicSplitNotFound />;
  }

  return <PublicSplitView split={split} />;
}
