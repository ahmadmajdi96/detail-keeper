import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface CoverageArea {
  name: string;
  size: number;
  testCount: number;
  passRate: number;
}

interface CoverageHeatmapProps {
  data: CoverageArea[];
}

// Custom content component for treemap cells
const CustomizedContent = (props: any) => {
  const { x, y, width, height, name, passRate, testCount } = props;

  if (width < 40 || height < 30) {
    return null;
  }

  // Color based on pass rate
  const getColor = (rate: number) => {
    if (rate >= 90) return 'hsl(var(--success))';
    if (rate >= 70) return 'hsl(142 76% 45%)';
    if (rate >= 50) return 'hsl(var(--warning))';
    if (rate >= 30) return 'hsl(38 92% 50%)';
    return 'hsl(var(--destructive))';
  };

  const color = getColor(passRate || 0);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: 'hsl(var(--background))',
          strokeWidth: 2,
          opacity: 0.85,
        }}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="white"
            fontSize={width > 100 ? 12 : 10}
            fontWeight="600"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="white"
            fontSize={width > 100 ? 11 : 9}
            opacity={0.9}
          >
            {testCount} tests
          </text>
          {width > 80 && height > 60 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 22}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              opacity={0.8}
            >
              {passRate}% pass
            </text>
          )}
        </>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground">{data.name}</p>
        <div className="mt-1 space-y-1 text-sm">
          <p className="text-muted-foreground">
            Tests: <span className="text-foreground font-medium">{data.testCount}</span>
          </p>
          <p className="text-muted-foreground">
            Pass Rate: <span className="text-foreground font-medium">{data.passRate}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function CoverageHeatmap({ data }: CoverageHeatmapProps) {
  const hasData = data.length > 0 && data.some(d => d.size > 0);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Test Coverage Heatmap</CardTitle>
        <CardDescription>Coverage distribution by application area (color = pass rate)</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">No coverage data available</p>
              <p className="text-xs mt-1">Add coverage tags to your test cases</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={data}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="hsl(var(--background))"
                  content={<CustomizedContent />}
                >
                  <Tooltip content={<CustomTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                <span className="text-xs text-muted-foreground">&lt;30%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(38 92% 50%)' }} />
                <span className="text-xs text-muted-foreground">30-50%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--warning))' }} />
                <span className="text-xs text-muted-foreground">50-70%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(142 76% 45%)' }} />
                <span className="text-xs text-muted-foreground">70-90%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--success))' }} />
                <span className="text-xs text-muted-foreground">&gt;90%</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}