const { spawnSync } = require('child_process');

function getTables(__const__data)
{
	const tables = {};
	const table_data = __const__data.split('\n').filter(v => v && !(['\taddb\t', '<unknown>', 'file format', 'Disassembly of'].some(str => v.includes(str)))).join('\n')
	for (const match of table_data.match(/[^\n][^]*?(?=\n_|$)/g) || [])
	{
		const name = match.split('\n', 1)[0].slice(0, -1)
		const funcs = [...new Set(match.match(/[^\s]+(?=\n|$)/g).slice(1))]
		tables[name] = { name, funcs }
	}
	return tables
}

function getFuncs(__text)
{
	const funcs = {}
	const foo = __text.split('\n').filter(v => v && /^_.*:$|\t(callq|leaq)\t/.test(v)).join('\n')
	for (const match of foo.match(/[^\n][^]*?(?=\n_|$)/g) || [])
	{
		const name = match.split('\n', 1)[0].slice(0, -1)
		const func_names = [...new Set(match.match(/(?<=callq\s(?:.*?\s)?)[_A-Za-z][_A-Za-z0-9]*(?=\S*(?:\n|$))/g) || [])]
		const tables = [...new Set(match.match(new RegExp(`(?<=leaq\\s(?:.*?\\s)?)${name}\\.[_A-Za-z][_A-Za-z0-9]*`, 'g')) || [])]
		funcs[name.slice(1)] = { name: name.slice(1), calls: func_names, called_by: [], tables, user_defined: true }
	}
	return funcs;
}

function fixData(funcs, tables)
{
	for (const func in funcs)
	{
		funcs[func].tables = funcs[func].tables.map(table => tables[table])
		for (const table of funcs[func].tables)
			funcs[func].calls.push(...table.funcs)
		funcs[func].calls = funcs[func].calls.map(n => {
			const name = n.slice(1)
			if (!funcs[name])
			{
				funcs[name] = {
					name,
					calls: [],
					called_by: [],
					user_defined: false
				}
			}
			funcs[name].called_by.push(funcs[func]);
			return (funcs[name]);
		})
	}
	return funcs
}

function exec(args)
{
	const argv0 = args.shift()
	const data = spawnSync(argv0, args)
	const err = data.stderr.toString()
	if (err)
		throw err;
	return data.stdout.toString()
}

module.exports = function getData(file)
{
	const __text = exec(["objdump", "-D", "-no-show-raw-insn", "-full-leading-addr", "-macho", file]) // nice function call names
	const __const__data = exec(["objdump", "-D", "-r", "-dynamic-reloc", "-no-show-raw-insn", "--section=__const", "--section=__data", "-full-leading-addr", file]) // nice table info

	const tables = getTables(__const__data)
	const funcs = getFuncs(__text)
	fixData(funcs, tables)
	return funcs
}
