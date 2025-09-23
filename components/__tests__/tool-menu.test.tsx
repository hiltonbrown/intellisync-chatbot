import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import type { ToolDefinition } from '@/lib/ai/tools/types';

const mockToolDefinitions: ToolDefinition[] = [
  {
    name: 'getWeather',
    label: 'Get weather',
    description: 'Fetch live weather.',
    inputSchema: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
    runtime: 'getWeather',
    ui: {
      submitLabel: 'Fetch weather',
      fields: [
        {
          type: 'text',
          name: 'latitude',
          label: 'Latitude',
          inputType: 'number',
          required: true,
        },
        {
          type: 'text',
          name: 'longitude',
          label: 'Longitude',
          inputType: 'number',
          required: true,
        },
      ],
    },
  },
  {
    name: 'requestSuggestions',
    label: 'Request suggestions',
    description: 'Collect document suggestions.',
    inputSchema: z.object({
      documentId: z.string().min(1),
    }),
    runtime: 'requestSuggestions',
    ui: {
      submitLabel: 'Request suggestions',
      fields: [
        {
          type: 'text',
          name: 'documentId',
          label: 'Document ID',
          required: true,
        },
      ],
    },
  },
];

import { ToolMenu } from '@/components/tool-menu';

describe('ToolMenu', () => {
  it('lists available tools in the dropdown', async () => {
    render(
      <ToolMenu
        onInvoke={vi.fn()}
        disabled={false}
        isLoading={false}
        activeTool={null}
        lastError={null}
        definitions={mockToolDefinitions}
      />,
    );

    const trigger = screen.getByRole('button', { name: /tools/i });
    await userEvent.click(trigger);

    expect(await screen.findByText('Get weather')).toBeInTheDocument();
    expect(screen.getByText('Request suggestions')).toBeInTheDocument();
  });

  it('submits tool input through the callback', async () => {
    const onInvoke = vi.fn().mockResolvedValue(undefined);

    render(
      <ToolMenu
        onInvoke={onInvoke}
        disabled={false}
        isLoading={false}
        activeTool={null}
        lastError={null}
        definitions={mockToolDefinitions}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /tools/i }));
    await userEvent.click(screen.getByText('Get weather'));

    const latitudeInput = await screen.findByLabelText('Latitude');
    const longitudeInput = screen.getByLabelText('Longitude');

    fireEvent.change(latitudeInput, { target: { value: '10' } });
    fireEvent.change(longitudeInput, { target: { value: '20' } });

    await userEvent.click(screen.getByRole('button', { name: /fetch weather/i }));

    await waitFor(() => {
      expect(onInvoke).toHaveBeenCalledWith('getWeather', {
        latitude: 10,
        longitude: 20,
      });
    });
  });

  it('shows validation errors for invalid input', async () => {
    const onInvoke = vi.fn().mockResolvedValue(undefined);

    render(
      <ToolMenu
        onInvoke={onInvoke}
        disabled={false}
        isLoading={false}
        activeTool={null}
        lastError={null}
        definitions={mockToolDefinitions}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /tools/i }));
    await userEvent.click(screen.getByText('Get weather'));

    const latitudeInput = await screen.findByLabelText('Latitude');
    const longitudeInput = screen.getByLabelText('Longitude');

    fireEvent.change(latitudeInput, { target: { value: 'abc' } });
    fireEvent.change(longitudeInput, { target: { value: '30' } });

    await userEvent.click(screen.getByRole('button', { name: /fetch weather/i }));

    expect(onInvoke).not.toHaveBeenCalled();
    const errors = await screen.findAllByText((_, element) =>
      element?.classList.contains('text-destructive'),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
