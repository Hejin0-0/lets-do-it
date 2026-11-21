// The fixed catalogue shared by the book and every visit; stable ids preserve saved finds. Shelves open in order:
// a visit and the book see only the shelves up to the first one with a missing page.
export const KIND_LABELS = Object.freeze({ bottle: 'A ship in a bottle', diorama: 'An island' });

export const COLLECTIBLES = Object.freeze([
  Object.freeze({ id: 'bottle-first', kind: 'bottle', shelf: 1, title: 'Sailboat in a bottle', description: 'A little sloop with paper sails, dry inside its glass.' }),
  Object.freeze({ id: 'bottle-second', kind: 'bottle', shelf: 1, title: 'Steamboat in a bottle', description: 'A paddle steamer with a red funnel, its smoke painted on the glass.' }),
  Object.freeze({ id: 'bottle-third', kind: 'bottle', shelf: 1, title: 'Pirate ship in a bottle', description: 'A black-sailed ship, its crew too small to see.' }),
  Object.freeze({ id: 'diorama-first', kind: 'diorama', shelf: 1, title: 'Volcano island', description: 'A smoking peak on a raft of rock, still warm.' }),
  Object.freeze({ id: 'diorama-second', kind: 'diorama', shelf: 1, title: 'Jungle island', description: 'Palms and vines so thick the shore is hidden.' }),
  Object.freeze({ id: 'diorama-third', kind: 'diorama', shelf: 1, title: 'Snowy island', description: 'One pine under fresh snow, cold in a summer sea.' }),
  Object.freeze({ id: 'bottle-fourth', kind: 'bottle', shelf: 2, title: 'Rowboat in a bottle', description: 'A little rowboat with a lantern at the bow, oars shipped.' }),
  Object.freeze({ id: 'bottle-fifth', kind: 'bottle', shelf: 2, title: 'Submarine in a bottle', description: 'A round-windowed submarine, its periscope up.' }),
  Object.freeze({ id: 'bottle-sixth', kind: 'bottle', shelf: 2, title: 'Longship in a bottle', description: 'A striped square sail over a row of round shields.' }),
  Object.freeze({ id: 'diorama-fourth', kind: 'diorama', shelf: 2, title: 'Lighthouse island', description: 'A striped lighthouse on a rock, its lamp still lit.' }),
  Object.freeze({ id: 'diorama-fifth', kind: 'diorama', shelf: 2, title: 'Shipwreck reef', description: 'A wrecked hull on a coral reef, half under the waves.' }),
  Object.freeze({ id: 'diorama-sixth', kind: 'diorama', shelf: 2, title: 'Fishing village', description: 'Three tiny houses by a jetty, smoke from one chimney.' }),
]);

/** The open shelf: the first with an item `found(id)` rejects, else the last. */
export function openShelf(found) {
  return COLLECTIBLES.find(({id}) => !found(id))?.shelf ?? COLLECTIBLES.at(-1).shelf;
}
