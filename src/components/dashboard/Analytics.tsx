import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Analytics = () => {
  const { gameState } = useGame();

  if (!gameState || gameState.rounds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No data available yet. Enter round data to see analytics.
        </CardContent>
      </Card>
    );
  }

  // Revenue over time
  const revenueData = gameState.rounds.map(round => {
    const dataPoint: any = { round: round.roundNumber };
    gameState.teams.forEach(team => {
      const teamData = round.teamData[team.id];
      if (teamData) {
        dataPoint[team.name] = teamData.revenue;
      }
    });
    return dataPoint;
  });

  // Production volume over time
  const productionData = gameState.rounds.map(round => {
    const dataPoint: any = { round: round.roundNumber };
    gameState.teams.forEach(team => {
      const teamData = round.teamData[team.id];
      if (teamData) {
        dataPoint[team.name] = teamData.productsProduced;
      }
    });
    return dataPoint;
  });

  // Price comparison
  const priceData = gameState.rounds.map(round => {
    const dataPoint: any = { round: round.roundNumber };
    gameState.teams.forEach(team => {
      const teamData = round.teamData[team.id];
      if (teamData) {
        dataPoint[team.name] = teamData.price;
      }
    });
    return dataPoint;
  });

  // Research allocation
  const researchData = gameState.rounds.map(round => {
    const dataPoint: any = { round: round.roundNumber };
    gameState.teams.forEach(team => {
      const teamData = round.teamData[team.id];
      if (teamData) {
        dataPoint[team.name] = teamData.researchIcons;
      }
    });
    return dataPoint;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>Track revenue performance across rounds</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="round" label={{ value: 'Round', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              {gameState.teams.map((team, index) => (
                <Line
                  key={team.id}
                  type="monotone"
                  dataKey={team.name}
                  stroke={team.color}
                  strokeWidth={2}
                  dot={{ fill: team.color, r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Production Volume</CardTitle>
            <CardDescription>Units produced per round (Stacked)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="round" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                {gameState.teams.map(team => (
                  <Bar key={team.id} dataKey={team.name} fill={team.color} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price Strategy</CardTitle>
            <CardDescription>Price levels over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="round" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                {gameState.teams.map(team => (
                  <Line
                    key={team.id}
                    type="monotone"
                    dataKey={team.name}
                    stroke={team.color}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Research Investment</CardTitle>
          <CardDescription>Research icons allocated per round (Stacked)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={researchData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="round" label={{ value: 'Round', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Research Icons', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              {gameState.teams.map(team => (
                <Bar key={team.id} dataKey={team.name} fill={team.color} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
