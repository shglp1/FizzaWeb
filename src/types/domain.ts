export type Role = 'parent'|'rider'|'driver'|'admin';
export type TripStatus='scheduled'|'driver_assigned'|'on_the_way'|'picked_up'|'completed'|'cancelled';
export interface Rider {id:string; name:string; school:string; grade:string; active:boolean; relationship:string;}
