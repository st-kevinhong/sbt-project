import { BigInt } from "@graphprotocol/graph-ts";
import { SBTMinted } from "./SBTContract";
import { Proof } from "./schema";

export function handleSBTMinted(event: SBTMinted): void {
  let proof = new Proof(event.transaction.hash.toHex());

  proof.did = event.params.did;
  proof.sender = event.params.sender;
  proof.timestamp = event.block.timestamp;

  proof.save();
}
