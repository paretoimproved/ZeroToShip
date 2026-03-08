export default async function DebugPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Debug Dynamic Route</h1>
      <p>ID: {id}</p>
      <p>Time: {new Date().toISOString()}</p>
      <p>Node: {process.version}</p>
    </div>
  );
}
