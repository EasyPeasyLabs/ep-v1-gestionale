
export interface Child {
  id: string;
  name: string;
  age: number;
  subscriptionId: string;
}

export enum SubscriptionStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Expired = 'Expired',
}

export interface Subscription {
  id: string;
  packageName: string;
  lessonsTotal: number;
  lessonsRemaining: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  children: Child[];
  subscriptions: Subscription[];
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  locations: Location[];
}

export interface Location {
    id: string;
    address: string;
    city: string;
    capacity: number;
}

export interface CompanyInfo {
    id: string;
    name: string;
    vatNumber: string;
    address: string;
    email: string;
    phone: string;
}

export type ParentInput = Omit<Parent, 'id'>;
export type SupplierInput = Omit<Supplier, 'id'>;
