import {useEffect, useRef} from 'react';
import {ColorType, LineSeries, createChart} from 'lightweight-charts';
import type {MarketTick} from '../hooks/useMarketWebSocket';

interface RealtimeChartProps {
    ticks: MarketTick[];
}

function RealtimeChart({ticks}: RealtimeChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
    const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const chart = createChart(container, {
            width: container.clientWidth,
            height: 340,
            layout: {
                background: {type: ColorType.Solid, color: '#ffffff'},
                textColor: '#475569',
            },
            grid: {
                vertLines: {color: '#edf1f4'},
                horzLines: {color: '#edf1f4'},
            },
            rightPriceScale: {borderColor: '#dce3e8'},
            timeScale: {borderColor: '#dce3e8', timeVisible: true, secondsVisible: true},
        });
        const series = chart.addSeries(LineSeries, {color: '#087e8b', lineWidth: 2});
        chartRef.current = chart;
        seriesRef.current = series;

        const resizeObserver = new ResizeObserver(() => chart.applyOptions({width: container.clientWidth}));
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;
        const points = new Map<number, number>();
        ticks.forEach((tick) => points.set(tick.time, tick.avg_price));
        series.setData([...points].map(([time, value]) => ({time: time as never, value})));
        chartRef.current?.timeScale().fitContent();
    }, [ticks]);

    return <div ref={containerRef} className="w-full" style={{height: 340}} />;
}

export default RealtimeChart;