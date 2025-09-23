export async function GET() {
  return Response.json({ message: 'Test route works!' });
}

export async function POST() {
  return Response.json({ message: 'Test POST works!' });
}