import { PieChart, Pie, Tooltip, Cell, Legend } from "recharts"
import "./PieChart.css"

export const CUSTOM_PIE_COLORS = [
    "#eb4e57",
    "#c12862",
    "#942270",
    "#7e468a",
    "#635a92",
    "#506e9a",
    "#2d8bba",
    "#41b8d5",
    "#6ce5e8",
]

function EmptyPiePlaceholder({ width, height }) {
    const r = Math.min(width, height) * 0.27
    const cx = width / 2
    const cy = height / 2
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
            <circle cx={cx} cy={cy} r={r} fill="#ececec" stroke="#ddd" strokeWidth="1" />
        </svg>
    )
}

/**
 * @param {{
 *   data: { name?: string, value?: number }[],
 *   name?: string,
 *   valueKey?: string,
 *   width?: number,
 *   height?: number,
 *   outerRadius?: number,
 * }} props
 */
export default function CustomPieChart({
    data,
    name,
    valueKey,
    width = 300,
    height = 300,
    outerRadius = 80,
}) {
    const vk = valueKey || "value"
    const nk = name || "name"
    const filtered = (data ?? []).filter((d) => Number(d[vk]) > 0)

    if (!filtered.length) {
        return <EmptyPiePlaceholder width={width} height={height} />
    }

    return (
        <PieChart width={width} height={height}>
            <Pie
                data={filtered}
                dataKey={vk}
                nameKey={nk}
                cx="50%"
                cy="50%"
                outerRadius={outerRadius}
                fill="#8884d8"
                stroke="none"
                labelLine={false}
            >
                {filtered.map((entry, index) => (
                    <Cell
                        key={`${entry[nk]}-${index}`}
                        fill={CUSTOM_PIE_COLORS[index % CUSTOM_PIE_COLORS.length]}
                        stroke={CUSTOM_PIE_COLORS[index % CUSTOM_PIE_COLORS.length]}
                    />
                ))}
            </Pie>
            <Tooltip />
            <Legend />
        </PieChart>
    )
}
