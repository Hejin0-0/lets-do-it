// The fixed catalogue shared by the book and every visit; stable ids preserve saved finds.
export const KIND_LABELS = Object.freeze({ bottle: 'A ship in a bottle', diorama: 'An island' });

export const COLLECTIBLES = Object.freeze([
  Object.freeze({ id: 'bottle-first', kind: 'bottle', title: 'Sailboat in a bottle', description: 'A little sloop with paper sails, dry inside its glass.' }),
  Object.freeze({ id: 'bottle-second', kind: 'bottle', title: 'Steamboat in a bottle', description: 'A paddle steamer with a red funnel, its smoke painted on the glass.' }),
  Object.freeze({ id: 'bottle-third', kind: 'bottle', title: 'Pirate ship in a bottle', description: 'A black-sailed ship, its crew too small to see.' }),
  Object.freeze({ id: 'diorama-first', kind: 'diorama', title: 'Volcano island', description: 'A smoking peak on a raft of rock, still warm.' }),
  Object.freeze({ id: 'diorama-second', kind: 'diorama', title: 'Jungle island', description: 'Palms and vines so thick the shore is hidden.' }),
  Object.freeze({ id: 'diorama-third', kind: 'diorama', title: 'Snowy island', description: 'One pine under fresh snow, cold in a summer sea.' }),
]);
