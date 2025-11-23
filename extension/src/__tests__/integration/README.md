# Integration Tests

Integration tests that make **real API calls** to the LiteLLM backend.

## Setup

1. Create `.env.local` in the `extension/` directory:
   ```bash
   LITELLM_API_KEY=your-api-key
   LITELLM_BASE_URL=https://your-backend-url
   LLM_MODEL=gemini-2.5-flash-lite
   ```

2. The `.env.local` file is already in `.gitignore` and will not be committed.

## Running Tests

```bash
# Run only integration tests (requires .env.local)
npm run test:integration

# Run only unit tests (no API calls)
npm test

# Run all tests (unit + integration)
npm run test:all
```

## Test Coverage

### LiteLLMClient Integration Tests

1. **Connection Test**: Verifies basic connectivity to LiteLLM backend
2. **Factual Error Detection**: Tests detection of factual errors (e.g., "Paris is the capital of London")
3. **TextQuoteSelector Format**: Validates proper annotation structure
4. **No Errors Handling**: Tests conversations with no issues
5. **Message Index**: Verifies annotations reference correct messages
6. **Error Handling**: Tests invalid API keys and endpoints

## What Gets Tested

- ✅ Real API calls to LiteLLM backend
- ✅ Actual AI model responses (gemini-2.5-flash-lite)
- ✅ Annotation creation and structure
- ✅ Category mapping (fact_error → factuality, etc.)
- ✅ TextQuoteSelector generation
- ✅ Error handling and retries
- ✅ Response parsing

## Notes

- Integration tests are **skipped automatically** if `.env.local` is missing
- Tests have 30-second timeout for API calls
- Console output shows detailed results for debugging
- Use these tests to verify backend connectivity before manual testing

## Example Output

```
🔧 Testing with: https://asgard.bhishmaraj.org
   Model: gemini-2.5-flash-lite
   API Key: sk-0wKxZmLvQx...

✅ Connection successful! Found 0 annotations

📊 Fact-check results:
   Found 1 annotations

📝 First annotation:
   Quote: "The capital of France is London"
   Category: factuality
   Strength: 9/10
   Note: The capital of France is Paris, not London.
```
