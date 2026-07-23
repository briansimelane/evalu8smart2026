import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getControlPointsForTeamInRound, getTeamPatentPoints, getInitialScore } from '@/types/game';

// Distinct colors for each Round / Period
const ROUND_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const REVENUE_COLORS = ['#10b981', '#14b8a6', '#059669', '#34d399', '#6ee7b7'];
const CONTROL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

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

  // Production volume stacked by Team (X-axis: Teams, Stacked segments: Rounds/Periods)
  const productionByTeamData = gameState.teams.map(team => {
    const dataPoint: Record<string, any> = { teamName: team.name };
    gameState.rounds.forEach(round => {
      const teamData = round.teamData[team.id];
      dataPoint[`Round ${round.roundNumber}`] = teamData ? teamData.productsProduced : 0;
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

  // Research allocation stacked by Team (X-axis: Teams, Stacked segments: Rounds/Periods)
  const researchByTeamData = gameState.teams.map(team => {
    const dataPoint: Record<string, any> = { teamName: team.name };
    gameState.rounds.forEach(round => {
      const allocated = gameState.researchAllocatedByRound[round.roundNumber]?.[team.id]
        ?? round.teamData[team.id]?.researchIcons
        ?? 0;
      dataPoint[`Round ${round.roundNumber}`] = allocated;
    });
    return dataPoint;
  });

  // Score breakdown stacked by Team (Starting Value + Revenue per round + Control per round)
  const scoreByTeamData = gameState.teams.map(team => {
    const dataPoint: Record<string, any> = {
      teamName: team.name,
      'Starting Value': getInitialScore(team)
    };

    gameState.rounds.forEach(round => {
      const td = round.teamData[team.id];
      dataPoint[`R${round.roundNumber} Revenue`] = td ? td.revenue : 0;
      dataPoint[`R${round.roundNumber} Control`] = getControlPointsForTeamInRound(round, team.id, gameState);
      if (round.roundNumber >= 5) {
        dataPoint['Patent Bonus'] = getTeamPatentPoints(team.id, gameState.patents, round.roundNumber);
      }
    });

    return dataPoint;
  });

  const scoreSegments: { key: string; color: string }[] = [];
  gameState.rounds.forEach((round, idx) => {
    scoreSegments.push({
      key: `R${round.roundNumber} Revenue`,
      color: REVENUE_COLORS[idx % REVENUE_COLORS.length]
    });
    scoreSegments.push({
      key: `R${round.roundNumber} Control`,
      color: CONTROL_COLORS[idx % CONTROL_COLORS.length]
    });
    if (round.roundNumber >= 5) {
      scoreSegments.push({
        key: 'Patent Bonus',
        color: '#a855f7'
      });
    }
  });

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Production Volume</CardTitle>
            <CardDescription>Cumulative units produced per team by round</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productionByTeamData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="teamName" />
                <YAxis label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                {gameState.rounds.map((round, idx) => (
                  <Bar
                    key={round.roundNumber}
                    dataKey={`Round ${round.roundNumber}`}
                    stackId="teamStack"
                    fill={ROUND_COLORS[idx % ROUND_COLORS.length]}
                  />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Research Investment</CardTitle>
            <CardDescription>Cumulative research icons allocated per team by round</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={researchByTeamData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="teamName" />
                <YAxis label={{ value: 'Research Icons', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                {gameState.rounds.map((round, idx) => (
                  <Bar
                    key={round.roundNumber}
                    dataKey={`Round ${round.roundNumber}`}
                    stackId="teamStack"
                    fill={ROUND_COLORS[idx % ROUND_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cumulative Score & Value Breakdown</CardTitle>
            <CardDescription>Starting value + Revenue & Control per round (Stacked to total score)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreByTeamData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="teamName" />
                <YAxis label={{ value: 'Total Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="Starting Value" stackId="scoreStack" fill="#64748b" />
                {scoreSegments.map((segment) => (
                  <Bar
                    key={segment.key}
                    dataKey={segment.key}
                    stackId="scoreStack"
                    fill={segment.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
