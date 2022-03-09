#!/usr/local/bin/node

const commandLineArgs = require('command-line-args');
const getData = require('./getData');
const util = require('util');
const fs = require('fs');

function Range(r)
{
	const match = r.match(/^(\d*)?(?:(\.\.)(\d*)?)?$/)
	if (match == null)
		throw `${r} is not a valid range`
	const min = isNaN(parseInt(match[1])) ? -Infinity : parseInt(match[1])
	let max;
	if (match[2] != '..')
		max = min
	else
		max = isNaN(parseInt(match[3])) ?  Infinity : parseInt(match[3])
	return { min: Math.min(min, max) , max: Math.max(min, max) }
}

function RangeBetween(range)
{
	const rrange = Range(range)
	return (r) => {
		const rr = Range(r)
		if (rr.min < rrange.min || rr.max > rrange.max)
			throw `Range must be between ${range.min} and ${range.max}`
		return rr
	}
}

function Enum(...values)
{
	return (v) => {
		if (!values.includes(v))
			throw `Value must be one of: ${util.inspect(values)}`
		return v
	}
}

function ExistingFile(p)
{
	if (!fs.existsSync(p))
		throw `file: "${p}" does not exist`
	return p
}

function commandLineArgs2(defs)
{
	let argv = process.argv
	const opts = []
	for (const def of defs)
	{
		opts.push(commandLineArgs(def[0], {argv, ...def[1]}))
		argv = opts[opts.length - 1]._unknown || []
	}
	return opts
}

const opts = commandLineArgs2([
	[
		[
			{ name: 'file', alias: 'f', type: ExistingFile, defaultOption: true },
		],
		{ stopAtFirstUnknown: true }
	],
	[
		[
			{ name: 'command', alias: 'c', type: Enum('list', 'used-by'), defaultOption: true, defaultValue: 'list' },
		],
		{ stopAtFirstUnknown: true }
	],
	[
		[
			{ name: 'system', alias: 's', type: Boolean },
			{ name: 'user', alias: 'u', type: Boolean },
			{ name: 'depth', alias: 'd', type: RangeBetween('0..'), defaultValue: Range('0..') },
			{ name: 'function', alias: 'p', type: String },
			{ name: 'in', alias: 'i', type: String },
		],
		{  }
	]
])

function getSystemFuncs(data)
{
	const system = {}
	for (const func in data)
	{
		if (data[func].user_defined)
			continue
		system[func] = data[func]
	}
	return system
}

function getUserFuncs(data)
{
	const user = {}
	for (const func in data)
	{
		if (!data[func].user_defined)
			continue
		user[func] = data[func]
	}
	return user
}

function getUsedIn(data, func_name, min_depth = 0, max_depth = Infinity, used_in = new Set(), depth = 0)
{
	for (const used_in_func of data[func_name].called_by)
	{
		if (!used_in.has(used_in_func.name))
		{
			if (depth >= min_depth)
				used_in.add(used_in_func.name)
			if (depth <= max_depth)
				getUsedIn(data, used_in_func.name, min_depth, max_depth, used_in, depth + 1)
		}
	}
	return ([...used_in])
}

function getUses(data, func_name, min_depth = 0, max_depth = Infinity, uses = new Set(), depth = 0)
{
	for (const uses_func of data[func_name].calls)
	{
		if (!uses.has(uses_func.name))
		{
			if (depth >= min_depth)
				uses.add(uses_func.name)
			if (depth <= max_depth)
				getUses(data, uses_func.name, min_depth, max_depth, uses, depth + 1)
		}
	}
	return ([...uses])
}

function getUsedByIn(data, func_name, in_name, min_depth, max_depth)
{
	console.log(arguments)
	const used_in = getUsedIn(data, func_name, min_depth, max_depth)
	console.log(used_in)
	const uses = getUses(data, in_name, min_depth, max_depth)
	return used_in.filter(func => uses.includes(func))
}

const data = getData(opts[0].file)
if (opts[2].in)
	uses = getUses(data, opts[2].in, opts[2].depth.min, opts[2].depth.max)
else
	uses = Object.keys(data)

function onlyIn(funcs, uses)
{
	return funcs.filter(func => uses.includes(func))
}

function logObj(obj)
{
	console.log(util.inspect(obj, {
		colors: true,
		depth: 0
	}))
}

switch (opts[1].command) {
	// default:
	case 'list':
		if (opts[2].user)
			logObj(onlyIn(Object.keys(getUserFuncs(data)), uses))
		if (opts[2].system)
			logObj(onlyIn(Object.keys(getSystemFuncs(data)), uses))
		if (!opts[2].user && !opts[2].system)
			logObj(onlyIn(Object.keys(data), uses))
		break;

	case 'used-by':
		logObj(onlyIn(getUsedIn(data, opts[2].function, opts[2].depth.min, opts[2].depth.max), uses))
		break;
}
// logObj(data._ft_calloc)

// logObj(getUsedIn(data, opts[1].function, opts[1].depth.min, opts[1].depth.max))

// console.log(data[opts.function])

// logObj(getUses(data, opts.function, opts.depth.min, opts.depth.max))

// logObj(getUsedByIn(data, opts.function, opts.in, opts.depth.min, opts.depth.max))

// logObj(getSystemFuncs(data))
