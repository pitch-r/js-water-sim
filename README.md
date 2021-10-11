# js-water-sim
Water simulator written in pure javascript

See example here: https://pitch-r.github.io/js-water-sim/

# Simulation notes

## Wave

From simple damped 2d wave equation
$$
\frac{\partial^2 h}{\partial t^2} + \delta \frac{\partial h}{\partial t} = c^2 \left( \frac{\partial^2 h}{\partial x^2} + \frac{\partial^2 h}{\partial y^2} \right)
$$
where $h$ = water height per cell, and $c$ = wave propagation speed

Add variable $v$ (velocity) :
$$
\begin{align*}
v &\triangleq \frac{\partial h}{\partial t} \\
\frac{\partial v}{\partial t} &= c^2 \left( \frac{\partial^2 h}{\partial x^2} + \frac{\partial^2 h}{\partial y^2} \right) - \delta v
\end{align*}
$$
Apply finite difference ($\Delta s$ = grid spacing, $\Delta t$ = time step):
$$
\begin{align*}
\frac{h_{new}-h}{\Delta t} &\approx v \\
h_{new} &\approx v \Delta t + h \\
\text{Let: } v' &\triangleq v \Delta t \\
h_{new} &\approx h + v' \\[9pt]

\frac{v_{new}-v}{\Delta t} &\approx c^2 \left[ 
    \frac{\frac{\partial h_{right}}{\partial x}-\frac{\partial h_{left}}{\partial x}}{\Delta x} + 
    \frac{\frac{\partial h_{below}}{\partial y}-\frac{\partial h_{above}}{\partial y}}{\Delta y} 
\right] - \delta v \\
&= c^2 \left[ 
    \frac{\left(h_{right} - h\right)-\left(h - h_{left}\right)}{\Delta x^2} + 
    \frac{\left(h_{below} - h\right)-\left(h - h_{above}\right)}{\Delta y^2}
\right] - \delta v \\
&= c^2 \left[ 
    \frac{h_{right} + h_{left} + h_{below} + h_{above} - 4 h}{\Delta s^2} 
\right] - \delta v \\
\frac{v'_{new}-v'}{\Delta t^2} &\approx c^2 \left[ 
    \frac{h_{right} + h_{left} + h_{below} + h_{above} - 4 h}{\Delta s^2} 
\right] - \frac{\delta v'}{\Delta t} \\
v'_{new} &\approx \frac{c^2 \Delta t^2}{\Delta s^2} \left(
    h_{right} + h_{left} + h_{below} + h_{above} - 4 h
\right) + \left(1 - \delta \Delta t\right) v' \\
\text{Let: } c' &\triangleq \frac{c \Delta t}{\Delta s},\;
\delta' \triangleq \delta \Delta t  \\
v'_{new} &\approx (1-\delta') v' + c'^2 \left(
    h_{right} + h_{left} + h_{below} + h_{above} - 4 h
\right) \\
\end{align*}
$$
$c'$ is wave propagation speed in [cell per timestep]. It must not exceed 1 due to [CFL condition](https://en.wikipedia.org/wiki/Courant%E2%80%93Friedrichs%E2%80%93Lewy_condition).


## Refraction

TODO

## Reflection

TODO
