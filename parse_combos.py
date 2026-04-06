data="""
1 1 -2 4 1 2 2
1 2 -2 4 1 2 2
1 3 -2 5 1 1 2
1 4 -2 4 1 1 2
1 5 -2 5 0 2 2
1 6 -2 6 0 1 2
1 7 -2 5 1 1 2
1 8 -1 3 1 2 2
1 9 -2 4 1 2 2
1 10 -1 4 1 2 2
1 11 -1 4 0 2 2
1 12 -2 4 1 2 2
1 13 -1 5 0 2 2
1 14 -1 5 0 2 2
2 1 -1 3 1 1 3
2 2 0 3 1 1 3
2 3 -1 4 1 1 3
2 4 -1 3 1 1 3
2 5 0 4 0 1 3
2 6 -1 5 0 1 3
2 7 -1 4 1 1 2
2 8 0 3 1 1 3
2 9 0 3 1 1 2
2 10 0 4 1 1 2
2 11 0 4 0 1 3
2 12 0 3 1 1 2
2 13 0 5 0 1 2
2 14 0 5 0 1 3
3 1 -1 4 1 2 1
3 2 -1 4 1 3 1
3 3 -1 5 1 2 1
3 4 -1 4 1 2 1
3 5 -1 5 0 3 1
3 6 -1 6 0 2 1
3 7 -1 5 1 2 1
3 8 0 3 1 3 1
3 9 -1 4 1 3 1
3 10 0 4 1 3 1
3 11 0 4 0 3 1
3 12 -1 4 1 3 1
3 13 0 5 0 3 1
3 14 0 5 0 3 1
4 1 0 3 1 2 2
4 2 1 3 1 2 2
4 3 0 4 1 2 2
4 4 0 3 1 2 2
4 5 1 4 0 2 2
4 6 0 5 0 2 2
4 7 0 4 1 2 1
4 8 1 3 1 2 2
4 9 1 3 1 2 1
4 10 1 4 1 2 1
4 11 1 4 0 2 2
4 12 1 3 1 2 1
4 13 1 5 0 2 1
4 14 1 5 0 2 2
5 1 -2 4 1 2 1
5 2 -2 4 1 2 2
5 3 -2 5 1 2 1
5 4 -2 5 1 2 0
5 5 -2 5 1 1 2
5 6 -2 7 1 1 0
5 7 -2 6 1 2 0
5 8 -1 3 1 2 2
5 9 -2 4 1 2 2
5 10 -1 4 1 1 2
5 11 -1 4 1 1 2
5 12 -2 5 1 2 1
5 13 -1 6 1 1 1
5 14 -1 5 1 1 2
6 1 0 3 1 1 2
6 2 0 3 1 1 3
6 3 0 4 1 1 2
6 4 0 4 1 1 1
6 5 0 4 1 0 3
6 6 0 6 1 0 1
6 7 0 5 1 1 1
6 8 1 2 1 1 3
6 9 0 3 1 1 3
6 10 1 3 1 1 3
6 11 1 3 1 0 3
6 12 0 1 1 1 2
6 13 1 5 1 0 2
6 14 1 4 1 0 3
7 1 -1 4 1 2 1
7 2 -1 4 1 3 1
7 3 -1 5 1 2 1
7 4 -1 5 1 1 1
7 5 -1 5 1 3 0
7 6 -1 7 1 1 0
7 7 -1 5 1 1 1
7 8 -1 4 1 3 1
7 9 -1 3 1 3 1
7 10 -1 4 1 3 1
7 11 -1 5 1 3 0
7 12 -1 4 1 2 1
7 13 -1 6 1 2 0
7 14 -1 6 1 3 0
8 1 1 3 1 1 2
8 2 1 3 1 2 2
8 3 1 4 1 1 2
8 4 1 4 1 0 2
8 5 1 4 1 2 1
8 6 1 4 1 0 1
8 7 1 4 1 0 2
8 8 1 3 1 2 2
8 9 1 2 1 2 2
8 10 1 3 1 2 2
8 11 1 4 1 2 1
8 12 1 3 1 1 2
8 13 1 5 1 1 1
8 14 1 5 1 1 2
"""

lines = data.strip().split("\n")
output = "export interface Combination {\n  combination: number;\n  position: number;\n  price: number;\n  products: number;\n  improve: number;\n  research: number;\n  logistics: number;\n}\n\nexport const COMBINATIONS: Combination[] = [\n"

for line in lines:
    parts = line.strip().split(" ")
    if len(parts) == 7:
        output += f"  {{ combination: {parts[0]}, position: {parts[1]}, price: {parts[2]}, products: {parts[3]}, improve: {parts[4]}, research: {parts[5]}, logistics: {parts[6]} }},\n"

output += "];\n\nexport const TEAM_COLORS = [\n  { name: 'Red', value: '#ef4444' },\n  { name: 'Blue', value: '#3b82f6' },\n  { name: 'Green', value: '#22c55e' },\n  { name: 'Yellow', value: '#eab308' },\n  { name: 'Purple', value: '#a855f7' },\n  { name: 'Black', value: '#1f2937' }\n];"

with open("src/data/combinations.ts", "w") as f:
    f.write(output)

print("combinations.ts generated")
