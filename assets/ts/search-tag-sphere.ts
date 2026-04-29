type SearchTopic = {
    label: string
    query: string
    type: string
    count: number
}

type SphereNode = {
    element: HTMLButtonElement
    x: number
    y: number
    z: number
}

const dataElement = document.getElementById("search-tag-sphere-data")
const panel = document.querySelector<HTMLElement>("[data-search-tag-sphere]")
const stage = document.querySelector<HTMLElement>("[data-search-tag-sphere-stage]")
const searchInput = document.querySelector<HTMLInputElement>(".search-form input[name='keyword']")
const searchResult = document.querySelector<HTMLElement>(".search-result")

if (!(dataElement instanceof HTMLScriptElement) || !panel || !stage || !searchInput) {
    throw new Error("Search tag sphere dependencies are missing.")
}

let topics: SearchTopic[] = []

try {
    const raw = JSON.parse(dataElement.textContent || "[]") as SearchTopic[] | string
    topics = typeof raw === "string" ? (JSON.parse(raw) as SearchTopic[]) : raw
} catch {
    topics = []
}

if (!topics.length) {
    panel.hidden = true
} else {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const nodes: SphereNode[] = []

    let radius = 0
    let autoVelocityX = prefersReducedMotion ? 0 : 0.0016
    let autoVelocityY = prefersReducedMotion ? 0 : -0.0022
    let dragVelocityX = 0
    let dragVelocityY = 0
    let pointerActive = false
    let pointerMoved = false
    let pointerId = -1
    let pointerStartTarget: HTMLElement | null = null
    let lastPointerX = 0
    let lastPointerY = 0
    let pointerStartX = 0
    let pointerStartY = 0
    let tickRafId = 0
    let revealRafId = 0
    let revealTimer = 0
    let hasRenderedOnce = false

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    const getRadius = () => Math.min(stage.clientWidth * 0.36, stage.clientHeight * 0.48)

    const applySearch = (query: string) => {
        searchInput.value = query
        panel.hidden = true
        panel.classList.remove("is-revealing")
        searchResult?.classList.remove("hidden")
        searchInput.focus()
        searchInput.dispatchEvent(new Event("input", { bubbles: true }))
        searchInput.dispatchEvent(new Event("change", { bubbles: true }))
        syncPanelVisibility()
    }

    const revealPanel = () => {
        if (!panel.hidden) {
            return
        }

        panel.hidden = false
        panel.classList.remove("is-revealing")

        if (revealRafId) {
            window.cancelAnimationFrame(revealRafId)
        }

        revealRafId = window.requestAnimationFrame(() => {
            syncSphereSize()
            render()
            panel.classList.add("is-revealing")
            revealRafId = 0

            if (revealTimer) {
                window.clearTimeout(revealTimer)
            }

            revealTimer = window.setTimeout(() => {
                panel.classList.remove("is-revealing")
            }, 520)
        })
    }

    const syncPanelVisibility = () => {
        const hasKeyword = searchInput.value.trim() !== ""

        if (hasKeyword) {
            panel.hidden = true
            panel.classList.remove("is-revealing")
            searchResult?.classList.remove("hidden")
        } else {
            revealPanel()
            searchResult?.classList.add("hidden")
        }
    }

    const rotateX = (point: SphereNode, angle: number) => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const nextY = point.y * cos - point.z * sin
        const nextZ = point.y * sin + point.z * cos
        point.y = nextY
        point.z = nextZ
    }

    const rotateY = (point: SphereNode, angle: number) => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const nextX = point.x * cos + point.z * sin
        const nextZ = point.z * cos - point.x * sin
        point.x = nextX
        point.z = nextZ
    }

    const render = () => {
        const stageWidth = stage.clientWidth
        const stageHeight = stage.clientHeight
        const centerX = stageWidth / 2
        const centerY = stageHeight / 2
        const perspective = radius * 2.4

        nodes.forEach((node) => {
            const depth = (node.z + radius) / (radius * 2)
            const scale = 0.5 + depth * 0.9
            const projectedX = (node.x * perspective) / (node.z + perspective)
            const projectedY = (node.y * perspective) / (node.z + perspective)
            const opacity = clamp(0.35 + depth * 0.75, 0.28, 1)

            node.element.style.transform = `translate3d(${centerX + projectedX}px, ${centerY + projectedY}px, 0) scale(${scale})`
            node.element.style.opacity = opacity.toFixed(3)
            node.element.style.zIndex = String(Math.round(depth * 100))
        })

        if (!hasRenderedOnce) {
            stage.classList.add("is-ready")
            hasRenderedOnce = true
        }
    }

    const tick = () => {
        const velocityX = pointerActive ? 0 : autoVelocityX + dragVelocityX
        const velocityY = pointerActive ? 0 : autoVelocityY + dragVelocityY

        if (velocityX !== 0 || velocityY !== 0) {
            nodes.forEach((node) => {
                rotateX(node, velocityX)
                rotateY(node, velocityY)
            })
            render()
        }

        if (!pointerActive) {
            dragVelocityX *= 0.96
            dragVelocityY *= 0.96

            if (Math.abs(dragVelocityX) < 0.00001) {
                dragVelocityX = 0
            }
            if (Math.abs(dragVelocityY) < 0.00001) {
                dragVelocityY = 0
            }
        }

        tickRafId = window.requestAnimationFrame(tick)
    }

    const syncSphereSize = () => {
        const nextRadius = getRadius()

        if (!Number.isFinite(nextRadius) || nextRadius <= 0) {
            return
        }

        if (!nodes.length || radius === 0) {
            radius = nextRadius
            return
        }

        const scaleFactor = nextRadius / radius
        radius = nextRadius

        if (!Number.isFinite(scaleFactor) || scaleFactor <= 0 || scaleFactor === 1) {
            return
        }

        nodes.forEach((node) => {
            node.x *= scaleFactor
            node.y *= scaleFactor
            node.z *= scaleFactor
        })
    }

    const buildNodes = () => {
        stage.replaceChildren()
        nodes.length = 0
        radius = getRadius()

        topics.forEach((topic, index) => {
            const total = topics.length
            const phi = Math.acos(1 - (2 * (index + 0.5)) / total)
            const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5)
            const x = radius * Math.sin(phi) * Math.cos(theta)
            const y = radius * Math.cos(phi)
            const z = radius * Math.sin(phi) * Math.sin(theta)

            const item = document.createElement("button")
            item.type = "button"
            item.className = `search-sphere-tag is-${topic.type}`
            item.textContent = topic.label
            item.setAttribute("aria-label", `搜索 ${topic.label}`)
            item.title = `${topic.label} (${topic.type})`
            item.dataset.query = topic.query
            item.draggable = false

            stage.appendChild(item)
            nodes.push({ element: item, x, y, z })
        })

        render()
    }

    stage.addEventListener("pointerdown", (event) => {
        event.preventDefault()
        pointerActive = true
        pointerMoved = false
        pointerId = event.pointerId
        dragVelocityX = 0
        dragVelocityY = 0
        pointerStartTarget = event.target instanceof HTMLElement
            ? (event.target.closest(".search-sphere-tag") as HTMLElement | null)
            : null
        pointerStartX = event.clientX
        pointerStartY = event.clientY
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        stage.setPointerCapture(pointerId)
        panel.classList.add("is-dragging")
    })

    stage.addEventListener("pointermove", (event) => {
        if (!pointerActive || event.pointerId !== pointerId) {
            return
        }

        const deltaX = event.clientX - lastPointerX
        const deltaY = event.clientY - lastPointerY
        const moveDistance = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY)
        const rotateByY = clamp(deltaX * 0.0065, -0.18, 0.18)
        const rotateByX = clamp(-deltaY * 0.0065, -0.18, 0.18)

        lastPointerX = event.clientX
        lastPointerY = event.clientY
        pointerMoved = pointerMoved || moveDistance > 6

        nodes.forEach((node) => {
            rotateX(node, rotateByX)
            rotateY(node, rotateByY)
        })
        render()

        dragVelocityY = clamp(deltaX * 0.00035, -0.08, 0.08)
        dragVelocityX = clamp(-deltaY * 0.00035, -0.08, 0.08)
    })

    const releasePointer = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
            return
        }

        if (!pointerMoved) {
            let tagTarget = pointerStartTarget
            if (!tagTarget) {
                const hitElement = document.elementFromPoint(event.clientX, event.clientY)
                tagTarget = hitElement instanceof HTMLElement
                    ? (hitElement.closest(".search-sphere-tag") as HTMLElement | null)
                    : null
            }

            if (tagTarget) {
                const query = tagTarget.dataset.query
                if (query) {
                    applySearch(query)
                }
            }
        }

        pointerActive = false
        pointerMoved = false
        pointerId = -1
        pointerStartTarget = null
        panel.classList.remove("is-dragging")
    }

    stage.addEventListener("pointerup", releasePointer)
    stage.addEventListener("pointercancel", releasePointer)
    stage.addEventListener("pointerleave", (event) => {
        if (pointerActive && event.pointerId === pointerId) {
            releasePointer(event)
        }
    })

    stage.addEventListener("mousemove", (event) => {
        if (pointerActive) {
            return
        }

        const rect = stage.getBoundingClientRect()
        const offsetX = (event.clientX - rect.left - rect.width / 2) / rect.width
        const offsetY = (event.clientY - rect.top - rect.height / 2) / rect.height

        autoVelocityY = prefersReducedMotion ? 0 : clamp(offsetX * 0.01, -0.008, 0.008)
        autoVelocityX = prefersReducedMotion ? 0 : clamp(offsetY * -0.01, -0.008, 0.008)
    })

    stage.addEventListener("mouseleave", () => {
        if (prefersReducedMotion) {
            return
        }

        autoVelocityX = 0.0016
        autoVelocityY = -0.0022
    })

    window.addEventListener("resize", () => {
        syncSphereSize()
        render()
    })

    searchInput.addEventListener("input", syncPanelVisibility)
    searchInput.addEventListener("change", syncPanelVisibility)
    window.addEventListener("pageshow", syncPanelVisibility)
    window.addEventListener("load", () => {
        window.setTimeout(syncPanelVisibility, 0)
    })

    buildNodes()
    syncPanelVisibility()
    tickRafId = window.requestAnimationFrame(tick)

    window.addEventListener("pagehide", () => {
        if (revealTimer) {
            window.clearTimeout(revealTimer)
        }
        if (revealRafId) {
            window.cancelAnimationFrame(revealRafId)
        }
        if (tickRafId) {
            window.cancelAnimationFrame(tickRafId)
        }
    })
}
