import { tool, type PluginContext, type Tool } from "@lmstudio/sdk";
import { z } from "zod";

// --- Safe expression evaluator (no eval) ---

type Token =
	| { k:"n"; v:number }
	| { k:"id"; v:string }
	| { k:"op"; v:string };

const math = Math as unknown as Record<string, unknown>;
const MATH_CONSTS = new Set(
	Object.getOwnPropertyNames(math).filter(k => typeof math[k] === "number"),
);
const MATH_FNS = new Set(
	Object.getOwnPropertyNames(math).filter(k => typeof math[k] === "function"),
);

function tokenize(src:string):Token[] {
	const tokens:Token[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) { i++; continue; }
		const num = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
		if (num) {
			tokens.push({ k: "n", v: Number(num[0]) });
			i += num[0].length;
			continue;
		}
		if (/[a-zA-Z]/.test(c)) {
			let j = i + 1;
			while (j < src.length && /[a-zA-Z0-9]/.test(src[j])) j++;
			tokens.push({ k: "id", v: src.slice(i, j) });
			i = j;
			continue;
		}
		if ("+-*/^(),".includes(c)) {
			tokens.push({ k: "op", v: c });
			i++;
			continue;
		}
		throw new Error(`Unexpected '${c}'`);
	}
	return tokens;
}

function evaluate(expression:string):number {
	const tokens = tokenize(expression);
	let p = 0;
	const peek = () => tokens[p];
	const take = () => tokens[p++];

	const primary = ():number => {
		const t = peek();
		if (!t) throw new Error("Unexpected end of expression");
		if (t.k === "n") { take(); return t.v; }
		if (t.k === "id") {
			const name = t.v;
			take();
			if (MATH_CONSTS.has(name))
				return math[name] as number;
			if (MATH_FNS.has(name)) {
				if (peek()?.k !== "op" || peek()?.v !== "(") throw new Error(`Expected '(' after ${name}`);
				take();
				const args:number[] = [];
				if (!(peek()?.k === "op" && peek()?.v === ")")) {
					args.push(add());
					while (peek()?.k === "op" && peek()?.v === ",") {
						take();
						args.push(add());
					}
				}
				if (peek()?.k !== "op" || peek()?.v !== ")") throw new Error("Expected ')'");
				take();
				const v = (math[name] as (...a:number[]) => number)(...args);
				if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Result is not a finite number");
				return v;
			}
			throw new Error(`Unknown identifier '${name}'`);
		}
		if (t.k === "op" && t.v === "(") {
			take();
			const v = add();
			if (peek()?.k !== "op" || peek()?.v !== ")") throw new Error("Expected ')'");
			take();
			return v;
		}
		throw new Error("Expected number, function, or '('");
	};

	const unary = ():number => {
		const t = peek();
		if (t?.k === "op" && t.v === "-") { take(); return -unary(); }
		if (t?.k === "op" && t.v === "+") { take(); return unary(); }
		return primary();
	};

	const pow = ():number => {
		let v = unary();
		if (peek()?.k === "op" && peek()?.v === "^") {
			take();
			v = Math.pow(v, pow());
		}
		return v;
	};

	const mul = ():number => {
		let v = pow();
		while (peek()?.k === "op" && (peek()?.v === "*" || peek()?.v === "/")) {
			const op = take().v;
			const r = pow();
			v = op === "*" ? v * r : v / r;
		}
		return v;
	};

	const add = ():number => {
		let v = mul();
		while (peek()?.k === "op" && (peek()?.v === "+" || peek()?.v === "-")) {
			const op = take().v;
			const r = mul();
			v = op === "+" ? v + r : v - r;
		}
		return v;
	};

	const result = add();
	if (p < tokens.length) throw new Error("Unexpected trailing input");
	if (!Number.isFinite(result)) throw new Error("Result is not a finite number");
	return result;
}

// --- Plugin ---

async function toolsProvider():Promise<Tool[]> {
	return [
		tool({
			name: "Calculator",
			description: "Evaluate a math expression. Operators: + - * / ^. All Math methods and constants (PI, E, sin, cos, sqrt, random, etc.) by their JS names. Supports parentheses and JS numbers.",
			parameters: {
				expression: z.string().describe("Math expression, e.g. 'sin(PI/2)', 'sqrt(16) + 2^3', 'max(1, 2)'"),
			},
			implementation: async ({ expression }) => {
				try {
					return { expression, result: evaluate(expression) };
				}
				catch (error) {
					return `Error: ${error instanceof Error ? error.message : String(error)}`;
				}
			},
		}),
	];
}

export async function main(context:PluginContext) {
	context.withToolsProvider(toolsProvider);
}
