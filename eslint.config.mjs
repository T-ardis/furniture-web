import next from "eslint-config-next";

// eslint-config-next 16.x ships a native flat config (an array of
// Linter.Config objects). Spread it directly — do NOT route it through
// FlatCompat, which JSON-stringifies plugin objects holding circular refs
// and crashes ESLint ("Converting circular structure to JSON").
const eslintConfig = [...next];

export default eslintConfig;
