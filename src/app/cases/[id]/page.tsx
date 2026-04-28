import { CaseDetailClient } from "@/components/case-detail/case-detail-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function CaseDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  return <CaseDetailClient id={id} tab={tab} />;
}
