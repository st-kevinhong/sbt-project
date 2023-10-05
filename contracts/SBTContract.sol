// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SBT is ERC721Enumerable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // 토큰 ID 별로 DID의 proof 저장
    mapping(uint256 => string) private _tokenProofs;

    constructor() ERC721("SBT", "SBT") {}

    function mint(address to, string memory proof) external {
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);
        _tokenProofs[tokenId] = proof;
        _tokenIdCounter.increment();
    }

    function getProofByTokenId(uint256 tokenId) external view returns (string memory) {
        return _tokenProofs[tokenId];
    }
}
