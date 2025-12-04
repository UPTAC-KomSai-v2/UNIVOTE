import {PieChart, Pie, Tooltip, Cell, Legend} from "recharts";
import './PieChart.css';

export default function CustomPieChart({data, name}) {
    const COLORS = ['#eb4e57', '#c12862', '#942270', '#7e468a', '#635a92', '#506e9a', '#2d8bba', '#41b8d5', '#6ce5e8'];
    
    const renderLabel = (entry) => {
        return `${entry.name}\n${entry.value}`;
};

    return (
        <PieChart width={300} height={300}>
            <Pie
                data={data}
                dataKey="value"
                nameKey={ name || "name" }
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                stroke="none"
                // label={renderLabel}
                label={renderLabel}
                labelLine={false}
            >
                {data.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]}
                        stroke={COLORS[index]}
                    />
                ))}
            </Pie>
            <Tooltip/>
            {/* <Legend/> */}
        </PieChart>
    )
}