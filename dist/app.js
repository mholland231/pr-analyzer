import { Octokit } from 'octokit';
import { plot } from 'nodeplotlib';
const prQuery = `
query paginate($cursor:String) {
    repository(owner:"vend", name: "reporting") {
        pullRequests(last: 100, before:$cursor) {
            nodes {
                createdAt
                mergedAt
                number
                title
                state
                author {
                    login
                }
                comments(last: 100) {
                    totalCount
                }
                reviewThreads(last: 100) {
                    nodes {
                        comments {
                            totalCount
                        }
                    }
                }
                mergeCommit {
                    additions
                    deletions
                    changedFilesIfAvailable
                }
            }
            pageInfo {
                hasPreviousPage
                startCursor
            }
        }
    }
}`;
const octokit = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });
const prInfoMap = new Map();
for await (const page of octokit.graphql.paginate.iterator(prQuery, { cursor: null })) {
    for (const pr of page.repository.pullRequests.nodes) {
        if (pr.state != "MERGED") {
            continue;
        }
        // const prInfo:any = await octokit.graphql(commentsQuery,{number: pr.number})
        const prComments = pr.comments.totalCount;
        const reviewComments = pr.reviewThreads.nodes.reduce((sum, node) => sum + node.comments.totalCount, 0);
        const commentCount = prComments + reviewComments;
        const linesChanged = pr.mergeCommit.additions + pr.mergeCommit.deletions;
        const filesChanged = pr.mergeCommit.changedFilesIfAvailable;
        const mergedDate = new Date(pr.mergedAt).valueOf();
        const createdDate = new Date(pr.createdAt).valueOf();
        const hoursToMerge = (Math.abs(mergedDate - createdDate) / 36e5);
        const timeToMerge = (hoursToMerge).toFixed(2);
        console.log(`PR #${pr.number} - ${pr.title} - ${commentCount} comments - ${pr.state} - ${timeToMerge} hours to merge - ${linesChanged} lines changed - ${filesChanged} files changed`);
        prInfoMap.set(pr.number, { commentCount, linesChanged, hoursToMerge, mergedAt: new Date(pr.mergedAt) });
    }
    const lastPRdate = page.repository.pullRequests.nodes[0].createdAt;
    if ((new Date(lastPRdate) < new Date("2023-01-01"))) {
        break;
    }
    // console.log(`${pullRequests.length} pull requests after ${lastPRdate}`)
}
const data = [
    {
        x: Array.from(prInfoMap.values()).map(pr => pr.linesChanged),
        y: Array.from(prInfoMap.values()).map(pr => pr.commentCount),
        mode: 'markers',
    }
];
console.log(prInfoMap);
plot(data);
