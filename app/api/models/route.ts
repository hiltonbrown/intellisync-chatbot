import { NextResponse } from 'next/server';
import { getStaticModels } from '../../../lib/ai/server-models';

export async function GET() {
  console.log('API MODELS: GET request received');
  try {
    const models = await getStaticModels();
    console.log('API MODELS: Returning models:', models.length);
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error loading models:', error);
    return NextResponse.json({ models: [] }, { status: 500 });
  }
}
