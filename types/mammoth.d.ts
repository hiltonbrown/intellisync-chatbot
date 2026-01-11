declare module "mammoth" {
	type ExtractRawTextResult = {
		value: string;
	};

	const extractRawText: (input: {
		buffer: Buffer;
	}) => Promise<ExtractRawTextResult>;

	export { extractRawText };
	export default {
		extractRawText,
	};
}
