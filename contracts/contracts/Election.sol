// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title Anonymous one-person-one-vote election built on Semaphore.
/// @notice Voters are registered as anonymous Semaphore identity commitments.
/// A vote is a zero-knowledge proof that the sender is one of the registered
/// voters, so nobody (the organiser included) can link a ballot to a person.
/// Semaphore's nullifier makes sure each identity can vote only once.
contract Election {
    enum Phase {
        Registration,
        Voting,
        Ended
    }

    error NotOrganiser();
    error WrongPhase(Phase expected, Phase actual);
    error AlreadyRegistered();
    error InvalidCandidate();
    error InvalidScope();
    error NoCandidates();
    error ResultsNotPublished();

    event VoterRegistered(uint256 identityCommitment);
    event VoteCast(uint256 nullifier);
    event PhaseChanged(Phase phase);

    ISemaphore public immutable semaphore;
    uint256 public immutable groupId;
    address public immutable organiser;

    string public title;
    string[] private candidates;
    Phase public phase;

    uint256[] private voters;
    uint256[] private tally;
    uint256 public totalVotes;

    /// @notice Keyed hashes of registered voter IDs (enrollment number, or email when no
    /// roster is used), so each student can register only once. The hash is keyed with a
    /// server secret, so the IDs cannot be recovered or guessed from it.
    mapping(bytes32 => bool) public voterIdRegistered;

    modifier onlyOrganiser() {
        if (msg.sender != organiser) revert NotOrganiser();
        _;
    }

    modifier inPhase(Phase expected) {
        if (phase != expected) revert WrongPhase(expected, phase);
        _;
    }

    constructor(ISemaphore _semaphore, string memory _title, string[] memory _candidates) {
        if (_candidates.length < 2) revert NoCandidates();

        semaphore = _semaphore;
        organiser = msg.sender;
        title = _title;
        candidates = _candidates;
        tally = new uint256[](_candidates.length);

        // This contract is the group admin, so only it can add members.
        // A long Merkle root duration keeps proofs made against a slightly
        // older root valid while other people are still registering.
        groupId = _semaphore.createGroup(address(this), 30 days);
    }

    /// @notice Adds an eligible voter's anonymous identity commitment.
    /// @param identityCommitment Public commitment of the voter's Semaphore identity.
    /// @param voterIdHash Keyed hash of the student's verified voter ID.
    function registerVoter(
        uint256 identityCommitment,
        bytes32 voterIdHash
    ) external onlyOrganiser inPhase(Phase.Registration) {
        if (voterIdRegistered[voterIdHash]) revert AlreadyRegistered();
        voterIdRegistered[voterIdHash] = true;

        semaphore.addMember(groupId, identityCommitment);
        voters.push(identityCommitment);

        emit VoterRegistered(identityCommitment);
    }

    function startVoting() external onlyOrganiser inPhase(Phase.Registration) {
        phase = Phase.Voting;
        emit PhaseChanged(Phase.Voting);
    }

    function endVoting() external onlyOrganiser inPhase(Phase.Voting) {
        phase = Phase.Ended;
        emit PhaseChanged(Phase.Ended);
    }

    /// @notice Casts an anonymous vote. Anyone may submit the proof (usually the relayer).
    /// @dev proof.message is the candidate index and proof.scope must equal groupId,
    /// so the nullifier is unique per voter per election.
    function castVote(ISemaphore.SemaphoreProof calldata proof) external inPhase(Phase.Voting) {
        if (proof.message >= candidates.length) revert InvalidCandidate();
        if (proof.scope != groupId) revert InvalidScope();

        // Reverts if the proof is invalid or the nullifier was already used.
        semaphore.validateProof(groupId, proof);

        tally[proof.message] += 1;
        totalVotes += 1;

        emit VoteCast(proof.nullifier);
    }

    function getCandidates() external view returns (string[] memory) {
        return candidates;
    }

    /// @notice All registered commitments, used by voters' browsers to rebuild the group.
    function getVoters() external view returns (uint256[] memory) {
        return voters;
    }

    function voterCount() external view returns (uint256) {
        return voters.length;
    }

    /// @notice Per-candidate counts, readable only once voting has ended.
    /// @dev Raw storage is public on any chain, so this hides live counts from
    /// the app and casual viewers, not from someone reading contract storage.
    function getResults() external view returns (uint256[] memory) {
        if (phase != Phase.Ended) revert ResultsNotPublished();
        return tally;
    }
}
