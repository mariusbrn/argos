import {
  GraphQLObjectType,
  GraphQLFloat,
  GraphQLString,
  GraphQLEnumType,
} from 'graphql'
import graphQLDateTime from 'modules/graphQL/graphQLDateTime'
import { pushBuildNotification } from 'modules/build/notifications'
import Build from 'server/models/Build'
import ScreenshotDiff from 'server/models/ScreenshotDiff'
import { VALIDATION_STATUS } from 'server/models/constant'
import ScreenshotType, {
  resolve as resolveScreenshot,
} from 'server/graphql/ScreenshotType'

export function resolveList(source, args) {
  return ScreenshotDiff
    .query()
    .where({
      buildId: args.buildId,
    })
    .orderBy('score', 'desc')
}

export const validationStatusType = new GraphQLEnumType({
  description: 'Represent the user feedback after reviewing the diffs',
  name: 'validationStatus',
  values: {
    unknown: {
      value: VALIDATION_STATUS.unknown,
    },
    accepted: {
      value: VALIDATION_STATUS.accepted,
    },
    rejected: {
      value: VALIDATION_STATUS.rejected,
    },
  },
})

export async function resolveSetValidationStatus(source, args, context) {
  const {
    buildId,
    validationStatus,
  } = args

  const user = await Build.getUsers(buildId).findById(context.user.id)

  if (!user) {
    throw new Error('Invalid user authorization')
  }

  await ScreenshotDiff
    .query()
    .where({
      buildId,
    })
    .patch({
      validationStatus,
    })

  // That might be better suited into a $afterUpdate hook.
  if (validationStatus === VALIDATION_STATUS.accepted) {
    await pushBuildNotification({
      buildId,
      type: 'diff-accepted',
    })
  } else if (validationStatus === VALIDATION_STATUS.rejected) {
    await pushBuildNotification({
      buildId,
      type: 'diff-rejected',
    })
  }

  return validationStatus
}

const ScreenshotDiffType = new GraphQLObjectType({
  name: 'ScreenshotDiff',
  fields: {
    id: {
      type: GraphQLString,
    },
    buildId: {
      type: GraphQLString,
    },
    baseScreenshotId: {
      type: GraphQLString,
    },
    baseScreenshot: {
      type: ScreenshotType,
      resolve: source => (
        resolveScreenshot(source, {
          id: source.baseScreenshotId,
        })
      ),
    },
    compareScreenshotId: {
      type: GraphQLString,
    },
    compareScreenshot: {
      type: ScreenshotType,
      resolve: source => (
        resolveScreenshot(source, {
          id: source.compareScreenshotId,
        })
      ),
    },
    score: {
      type: GraphQLFloat,
    },
    s3Id: {
      type: GraphQLString,
    },
    jobStatus: {
      type: new GraphQLEnumType({
        description: 'Represent the state of the remote job generating the diffs',
        name: 'jobDiffStatus',
        values: {
          pending: {
            value: 'pending',
          },
          progress: {
            value: 'progress',
          },
          complete: {
            value: 'complete',
          },
        },
      }),
    },
    validationStatus: {
      type: validationStatusType,
    },
    createdAt: {
      type: graphQLDateTime,
    },
    updatedAt: {
      type: graphQLDateTime,
    },
  },
})

export default ScreenshotDiffType
