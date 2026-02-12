import { RootRoute, Router } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = new Router({ routeTree })
