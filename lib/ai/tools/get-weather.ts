import { tool } from 'ai';
import { getWeatherInputSchema } from './schemas';

export const getWeather = tool({
  description: 'Get the current weather at a location',
  inputSchema: getWeatherInputSchema,
  execute: async ({ latitude, longitude }) => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
      );

      if (!response.ok) {
        return {
          error: `Weather API request failed with status ${response.status}`,
        };
      }

      const weatherData = await response.json();

      if (weatherData.error) {
        return {
          error: `Weather API error: ${weatherData.reason || weatherData.error}`,
        };
      }

      return weatherData;
    } catch (error) {
      return {
        error: `Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
