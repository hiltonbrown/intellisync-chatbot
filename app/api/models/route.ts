import { NextResponse } from 'next/server';
import { getStaticModels } from '@/lib/ai/server-models';

export async function GET() {
  try {
    const models = await getStaticModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error loading models:', error);
    return NextResponse.json({ models: [] }, { status: 500 });
  }
}
