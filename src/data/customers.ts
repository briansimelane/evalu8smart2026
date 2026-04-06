export interface Customer {
  id: string;
  type: 'price' | 'value';
  price?: number; // For price customers
  technology?: string; // For value customers
  position: number; // Order in which they can be sold to (left to right)
}

export interface RegionCustomers {
  region: string;
  customers: Customer[];
}

// Customer data for each region
// Price customers: Team price must be <= customer price
// Value customers: Team must have completed the required technology
export const REGION_CUSTOMERS: RegionCustomers[] = [
  {
    region: 'Canada',
    customers: [
      { id: 'can-p1', type: 'price', price: 4, position: 1 },
      { id: 'can-v1', type: 'value', technology: 'GPS', position: 2 },
      { id: 'can-v2', type: 'value', technology: 'Battery', position: 3 },
      { id: 'can-v3', type: 'value', technology: '4G', position: 4 },
    ]
  },
  {
    region: 'Europe',
    customers: [
      { id: 'eur-p1', type: 'price', price: 4, position: 1 },
      { id: 'eur-p2', type: 'price', price: 5, position: 2 },
      { id: 'eur-p3', type: 'price', price: 6, position: 3 },
      { id: 'eur-p4', type: 'price', price: 7, position: 4 },
      { id: 'eur-v1', type: 'value', technology: 'Wifi', position: 5 },
      { id: 'eur-v2', type: 'value', technology: 'Battery', position: 6 },
      { id: 'eur-v3', type: 'value', technology: 'NFC', position: 7 },
      { id: 'eur-v4', type: 'value', technology: '4G', position: 8 },
    ]
  },
  {
    region: 'CIS',
    customers: [
      { id: 'cis-p1', type: 'price', price: 3, position: 1 },
      { id: 'cis-p2', type: 'price', price: 5, position: 2 },
      { id: 'cis-p3', type: 'price', price: 7, position: 3 },
      { id: 'cis-v1', type: 'value', technology: 'Wifi', position: 4 },
      { id: 'cis-v2', type: 'value', technology: 'Gaming', position: 5 },
      { id: 'cis-v3', type: 'value', technology: '4G', position: 6 },
    ]
  },
  {
    region: 'USA',
    customers: [
      { id: 'usa-p1', type: 'price', price: 3, position: 1 },
      { id: 'usa-p2', type: 'price', price: 4, position: 2 },
      { id: 'usa-p3', type: 'price', price: 5, position: 3 },
      { id: 'usa-p4', type: 'price', price: 6, position: 4 },
      { id: 'usa-v1', type: 'value', technology: 'Wifi', position: 5 },
      { id: 'usa-v2', type: 'value', technology: 'Gaming', position: 6 },
      { id: 'usa-v3', type: 'value', technology: 'NFC', position: 7 },
      { id: 'usa-v4', type: 'value', technology: '4G', position: 8 },
    ]
  },
  {
    region: 'Emirates',
    customers: [
      { id: 'emi-p1', type: 'price', price: 6, position: 1 },
      { id: 'emi-v1', type: 'value', technology: 'Gaming', position: 2 },
      { id: 'emi-v2', type: 'value', technology: 'NFC', position: 3 },
      { id: 'emi-v3', type: 'value', technology: '4G', position: 4 },
    ]
  },
  {
    region: 'China',
    customers: [
      { id: 'chn-p1', type: 'price', price: 2, position: 1 },
      { id: 'chn-p2', type: 'price', price: 4, position: 2 },
      { id: 'chn-p3', type: 'price', price: 5, position: 3 },
      { id: 'chn-v1', type: 'value', technology: 'GPS', position: 4 },
      { id: 'chn-v2', type: 'value', technology: 'Gaming', position: 5 },
      { id: 'chn-v3', type: 'value', technology: 'Battery', position: 6 },
      { id: 'chn-v4', type: 'value', technology: 'NFC', position: 7 },
      { id: 'chn-v5', type: 'value', technology: '4G', position: 8 },
    ]
  },
  {
    region: 'Caribbean',
    customers: [
      { id: 'car-p1', type: 'price', price: 3, position: 1 },
      { id: 'car-p2', type: 'price', price: 7, position: 2 },
      { id: 'car-v1', type: 'value', technology: 'Battery', position: 3 },
      { id: 'car-v2', type: 'value', technology: '4G', position: 4 },
    ]
  },
  {
    region: 'North Africa',
    customers: [
      { id: 'naf-p1', type: 'price', price: 3, position: 1 },
      { id: 'naf-p2', type: 'price', price: 6, position: 2 },
      { id: 'naf-v1', type: 'value', technology: 'Wifi', position: 3 },
      { id: 'naf-v2', type: 'value', technology: 'Battery', position: 4 },
      { id: 'naf-v3', type: 'value', technology: 'NFC', position: 5 },
      { id: 'naf-v4', type: 'value', technology: '4G', position: 6 },
    ]
  },
  {
    region: 'India',
    customers: [
      { id: 'ind-p1', type: 'price', price: 3, position: 1 },
      { id: 'ind-p2', type: 'price', price: 5, position: 2 },
      { id: 'ind-p3', type: 'price', price: 6, position: 3 },
      { id: 'ind-v1', type: 'value', technology: 'Gaming', position: 4 },
      { id: 'ind-v2', type: 'value', technology: 'NFC', position: 5 },
      { id: 'ind-v3', type: 'value', technology: '4G', position: 6 },
    ]
  },
  {
    region: 'South America',
    customers: [
      { id: 'sam-p1', type: 'price', price: 2, position: 1 },
      { id: 'sam-p2', type: 'price', price: 4, position: 2 },
      { id: 'sam-p3', type: 'price', price: 5, position: 3 },
      { id: 'sam-v1', type: 'value', technology: 'GPS', position: 4 },
      { id: 'sam-v2', type: 'value', technology: 'Gaming', position: 5 },
      { id: 'sam-v3', type: 'value', technology: 'Battery', position: 6 },
    ]
  },
  {
    region: 'RSA',
    customers: [
      { id: 'rsa-p1', type: 'price', price: 2, position: 1 },
      { id: 'rsa-p2', type: 'price', price: 5, position: 2 },
      { id: 'rsa-v1', type: 'value', technology: 'Wifi', position: 3 },
      { id: 'rsa-v2', type: 'value', technology: 'NFC', position: 4 },
    ]
  },
  {
    region: 'Australia',
    customers: [
      { id: 'aus-p1', type: 'price', price: 4, position: 1 },
      { id: 'aus-p2', type: 'price', price: 6, position: 2 },
      { id: 'aus-v1', type: 'value', technology: 'Wifi', position: 3 },
      { id: 'aus-v2', type: 'value', technology: 'Battery', position: 4 },
      { id: 'aus-v3', type: 'value', technology: 'NFC', position: 5 },
      { id: 'aus-v4', type: 'value', technology: '4G', position: 6 },
    ]
  }
];
